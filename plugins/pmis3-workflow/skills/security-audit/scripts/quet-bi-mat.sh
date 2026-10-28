#!/usr/bin/env bash
# quet-bi-mat.sh — sàng lọc nhanh bí mật viết cứng (nhóm (ii) của skill security-audit).
# Công cụ SÀNG LỌC: mọi dòng trúng chỉ là ứng viên, phải xác minh. Không thay thế công cụ quét bí mật trong CI.
#
# Cách dùng:
#   bash quet-bi-mat.sh [--bo-test] [thư-mục]   # mặc định: thư mục hiện tại
#   bash quet-bi-mat.sh [--bo-test] --diff      # tệp đổi so với BASE_BRANCH (mặc định origin/dev, rồi origin/main)
#
#   --bo-test  bỏ qua mã test (src/test, e2e, src/testing, *.spec.ts, *Test.java, *IT.java)
#
# An toàn: KHÔNG đọc .env*, *.pem, *.key, *.p12, *.jks, *credentials*.json (chỉ liệt kê nếu chúng bị git theo dõi);
# giá trị trúng được che bớt khi in để bí mật không lọt nguyên văn vào log / ngữ cảnh AI.
# Chỉ dùng grep -E (ERE) để chạy được trên Git Bash (Windows), Linux và macOS.
#
# Mã thoát: 0 = không có ứng viên · 1 = có ứng viên cần xác minh · 2 = lỗi tham số

set -uo pipefail

MODE="dir"
TARGET="."
SKIP_TEST=0
for arg in "$@"; do
  case "$arg" in
    --diff) MODE="diff" ;;
    --bo-test) SKIP_TEST=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    -*) echo "Tham số không hợp lệ: $arg"; exit 2 ;;
    *) TARGET="$arg" ;;
  esac
done

EXCLUDE_DIRS='/(node_modules|\.git|target|build|dist|bin|obj|\.angular|\.venv|vendor|coverage)/'
SENSITIVE_FILES='(^|/)(\.env[^/]*|[^/]*\.(pem|key|p12|pfx|jks)|[^/]*credentials[^/]*\.json)$'
TEST_PATHS='(/src/test/|(^|/)e2e/|/src/testing/|\.spec\.ts$|Test\.java$|IT\.java$)'
INCLUDE_EXT='\.(java|kt|cs|ts|tsx|js|jsx|mjs|cjs|html|yml|yaml|json|properties|xml|sql|sh|ps1|cmd|bat|conf|ini|toml|md)$'

# MÃ|MÔ TẢ|BIỂU THỨC ERE (so khớp không phân biệt hoa thường)
PATTERNS=(
  "S01|Mật khẩu viết cứng|(password|passwd|pwd|matkhau|mat_khau)[\"']?[[:space:]]*[:=][[:space:]]*[\"'][^\"'\$\{[:space:]][^\"']{3,}[\"']"
  "S02|API key / secret / token viết cứng|(api[_-]?key|secret([_-]?key)?|client[_-]?secret|access[_-]?token|auth[_-]?token|private[_-]?key)[\"']?[[:space:]]*[:=][[:space:]]*[\"'][^\"'\$\{[:space:]][^\"']{8,}[\"']"
  "S03|Khóa riêng (private key)|-----BEGIN [A-Z ]*PRIVATE KEY-----"
  "S04|Chuỗi kết nối có mật khẩu|(server|data source|host)[[:space:]]*=[^;\"']+;.*(password|pwd)[[:space:]]*=[^;\$\{]"
  "S05|JDBC URL có mật khẩu|jdbc:[a-z]+:[^\"'[:space:]]*password=[^;&\$\{]"
  "S06|Bearer token viết cứng|bearer[[:space:]]+[A-Za-z0-9_.=-]{20,}"
  "S07|JWT viết cứng|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}"
  "S08|Địa chỉ IP nội bộ viết cứng|(10\.[0-9]{1,3}|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}"
)

if [[ "$MODE" == "diff" ]]; then
  BASE=""
  for b in "${BASE_BRANCH:-}" origin/dev origin/main; do
    [[ -n "$b" ]] && BASE="$(git merge-base HEAD "$b" 2>/dev/null)" && [[ -n "$BASE" ]] && break
  done
  [[ -z "$BASE" ]] && BASE="HEAD~1"
  ALL_FILES="$(git diff --name-only --diff-filter=ACMR "$BASE" 2>/dev/null)"
  echo "Phạm vi: tệp thay đổi so với $BASE"
else
  [[ -d "$TARGET" ]] || { echo "Không tìm thấy thư mục: $TARGET"; exit 2; }
  ALL_FILES="$(find "$TARGET" -type f 2>/dev/null)"
  echo "Phạm vi: $TARGET"
fi

# Tệp nhạy cảm: chỉ báo tên nếu đang bị git theo dõi, không đọc nội dung
SENSITIVE="$(printf '%s\n' "$ALL_FILES" | grep -E "$SENSITIVE_FILES" | grep -Ev '\.example$|\.template$' || true)"
TRACKED_SENSITIVE=""
if [[ -n "$SENSITIVE" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  TRACKED_SENSITIVE="$(printf '%s\n' "$SENSITIVE" | while IFS= read -r f; do
      git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && echo "$f"; done)"
fi

FILES="$(printf '%s\n' "$ALL_FILES" | grep -E "$INCLUDE_EXT" | grep -Ev "$EXCLUDE_DIRS" \
    | grep -Ev "$SENSITIVE_FILES" | grep -v 'package-lock\.json$' || true)"
if [[ $SKIP_TEST -eq 1 ]]; then
  FILES="$(printf '%s\n' "$FILES" | grep -Ev "$TEST_PATHS" || true)"
fi

# Che giá trị trong "tệp:dòng:nội dung": cụm ≥ 8 ký tự không cách/không ngoặc giữ 3 ký tự đầu, trừ định danh chữ thường
# (password, api_key…) để vẫn đọc được tên khóa. Không dùng {n} / gensub để chạy được với mọi awk.
mask() {
  local ch="[^ \t\"'\`,;()]"
  awk -v re="$ch$ch$ch$ch$ch$ch$ch$ch$ch*" '{
    i = index($0, ":"); j = index(substr($0, i + 1), ":")
    p = substr($0, 1, i + j); c = substr($0, i + j + 1); sub(/^[ \t]+/, "", c); out = ""
    while (match(c, re)) {
      tok = substr(c, RSTART, RLENGTH)
      out = out substr(c, 1, RSTART - 1) (tok ~ /^[a-z_.-]+$/ ? tok : substr(tok, 1, 3) "***")
      c = substr(c, RSTART + RLENGTH)
    }
    print substr(p " " out c, 1, 200)
  }'
}

FOUND=0
if [[ -n "$TRACKED_SENSITIVE" ]]; then
  FOUND=1
  echo ""
  echo "[S00] Tệp bí mật đang bị git theo dõi (không đọc nội dung)"
  printf '%s\n' "$TRACKED_SENSITIVE" | sed 's/^/    /'
fi

if [[ -z "$FILES" ]]; then
  echo "Không có tệp mã nào để quét."
else
  echo "Số tệp quét: $(printf '%s\n' "$FILES" | wc -l | tr -d ' ')"
  echo "----------------------------------------------------------------"
  for entry in "${PATTERNS[@]}"; do
    code="${entry%%|*}"; rest="${entry#*|}"
    desc="${rest%%|*}"; regex="${rest#*|}"
    hits="$(printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 grep -inEH -- "$regex" 2>/dev/null \
        | mask | head -50)"
    if [[ -n "$hits" ]]; then
      FOUND=1
      echo ""
      echo "[$code] $desc"
      printf '%s\n' "$hits" | sed 's/^/    /'
    fi
  done
fi

echo ""
echo "----------------------------------------------------------------"
if [[ $FOUND -eq 1 ]]; then
  cat <<'MSG'
KẾT QUẢ: CÓ ỨNG VIÊN CẦN XÁC MINH.
  1. Xác minh từng dòng (dữ liệu test, giá trị mẫu, ${ENV} là báo nhầm) và ghi lý do vào danh mục báo nhầm.
  2. Bí mật THẬT đã lên remote: XOAY VÒNG trong 08 giờ TRƯỚC, xóa khỏi lịch sử Git SAU.
  3. Kiểm lịch sử Git: git log --all -p -S '<chuỗi>' -- <tệp>
MSG
  exit 1
fi
echo "KẾT QUẢ: Không có ứng viên. Đây chỉ là sàng lọc — công cụ quét bí mật trong CI vẫn bắt buộc."
exit 0
