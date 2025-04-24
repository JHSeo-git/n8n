# Deployment

> https://github.com/n8n-io/n8n-hosting/blob/main/kubernetes/README.md

공식 문서에서 kubernetes 환경으로 가이드 되어 있고, 단일 컨테이너를 사용한다고 가정하여 가이드 합니다.

## 리소스

- DB: PostgreSQL
- n8n: Node.js (WAS)

n8n 서버(`packages/cli`)에서 이미 빌드완료된 Frontend 정적 파일(`packages/frontend/editor-ui`)을 서빙하는 구조입니다.
빌더 단계에서 생성된 `/compiled` 디렉토리의 내용이 최종 이미지의 `/usr/local/lib/node_modules/n8n`으로 복사됩니다.

따라서 Frontend 정적 파일들은:
1. 빌드 시점에 `/compiled` 디렉토리에 생성되고
2. Docker 이미지 빌드 과정에서 `/usr/local/lib/node_modules/n8n` 디렉토리로 복사되며
3. n8n 서버가 시작될 때 이 위치에서 파일들을 서빙하게 됩니다

## 서비스 단위

- DB
- n8n

## Pod resources

- https://docs.n8n.io/hosting/installation/server-setups/aws/#pod-resources

아래 표는 공식 문서에서 제공하는 리소스 사용량입니다. 참고하여 kubernetes node 스펙을 결정합니다.

### 참고: n8n cloud resource spec

- Start: 320mb RAM, 10 millicore CPU burstable
- Pro (10k 실행): 640mb RAM, 20 millicore CPU burstable
- Pro (50k 실행): 1280mb RAM, 80 millicore CPU burstable