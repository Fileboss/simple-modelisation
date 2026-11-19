#!/bin/sh
# Smoke test of a built image, before it is pushed: it starts as a relay with the
# public example's restrictions, gets healthy, serves the app under its CSP, and
# carries no package manager. Usage: scripts/smoke-image.sh <image>
set -eu
image=$1
name=smoke-$$
port=${SMOKE_PORT:-3999}

fail() {
	echo "smoke: $1" >&2
	docker logs "$name" >&2 || true
	exit 1
}

trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -p "127.0.0.1:$port:3000" -e STORAGE=none \
	--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
	"$image" >/dev/null

status=starting
for _ in $(seq 1 30); do
	[ "$(docker inspect -f '{{.State.Running}}' "$name")" = true ] || fail "the container exited"
	status=$(docker inspect -f '{{.State.Health.Status}}' "$name")
	[ "$status" = healthy ] && break
	[ "$status" = unhealthy ] && break
	sleep 1
done
[ "$status" = healthy ] || fail "health status is $status"

[ "$(curl -fsS "http://127.0.0.1:$port/health")" = ok ] || fail "/health is not ok"

headers=$(curl -fsS -D - -o /dev/null "http://127.0.0.1:$port/")
echo "$headers" | grep -qi '^content-type: text/html' || fail "/ is not HTML"
echo "$headers" | grep -qi '^content-security-policy:' || fail "/ has no CSP"

for tool in npm npx corepack pnpm yarn; do
	if docker run --rm --entrypoint sh "$image" -c "command -v $tool" >/dev/null; then
		fail "$tool is in the image"
	fi
done

echo "smoke: $image ok"
