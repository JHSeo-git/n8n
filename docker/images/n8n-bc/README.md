# n8n - Custom Image

Dockerfile which allows to package up the local n8n code into a docker image.

## Usage

Execute the following in the n8n `root` folder:

```bash
docker build -t aoaiaiplayground.azurecr.io/axpg/n8n -f docker/images/n8n-bc/Dockerfile .
docker build --platform linux/amd64 -t aoaiaiplayground.azurecr.io/axpg/n8n -f docker/images/n8n-bc/Dockerfile.local .
# docker build -t core.harbor.local/bc/n8n-bc -f docker/images/n8n-bc/Dockerfile .
```

```bash
docker run --rm --name n8n-bc -p 5678:5678 -v n8n_data:/home/node/.n8n n8n-bc
# docker run --rm --name n8n-bc -p 5678:5678 -v n8n_data:/home/node/.n8n core.harbor.local/bc/n8n-bc
```
