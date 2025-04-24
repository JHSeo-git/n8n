# Blocking Nodes

- https://docs.n8n.io/hosting/securing/blocking-nodes/

`.env` 환경변수(`NODES_EXCLUDE`)를 사용하여 사용자가 특정 노드에 액세스하지 못하도록 합니다.

```bash
# .env
NODES_EXCLUDE: "[\"n8n-nodes-base.executeCommand\", \"n8n-nodes-base.readWriteFile\"]"
```