# remockable

Remockable is a zero-friction web application mockup tool.

## Installation

```sh
npm install -g @smeans/remockable
```

Or run it once without installing:

```sh
npx @smeans/remockable
```

## Usage

```sh
remockable                # -> serve mocks tree from cwd
remockable ~/mocks        # -> serve mocks tree from provided folder
remockable --help
remockable --version
```

### Server Options

| Option              | Description                                | Default   |
| ------------------- | ------------------------------------------ | --------- |
| `-p, --port <port>` | Port to listen on                          | `3333`    |
| `-H, --host <ip>`   | IP address / hostname to bind the server   | `0.0.0.0` |

```sh
remockable --port 8080                 # -> serve on port 8080
remockable --host 127.0.0.1            # -> only accept local connections
remockable ~/mocks --port 8080 --host 127.0.0.1
```

The server binds to `0.0.0.0:3333` by default, making it reachable from other
devices on your network.

## Mock Tree Structure
The mocks tree folder serves as the root of a temporary site served by the `remockable` command. All normal (non-hidden, non .hidden) are served as static content with their mime type determined by their file extension.
File extensions are optional, so a request for `/images/logo` is equivalent to `/images/logo.png`. If two files only differ by their extension, the server returns a 404.
## Mock Request Mapping
Requests for a given folder will return the file in that folder named `index.xxx`.
The key feature of `remockable` is the ability to host different HTTP verbs through file naming conventions. Take the following directory listing:
```
/posts
    index.json
    index.POST.json
    1234.json
    1234.DELETE.json
```
The request `GET /posts` will return the contents of `index.json`, but `POST /posts` will return the contents of `index.POST.json`. Similarly the request `GET /posts/1234` returns the contents of `1234.json` but `DELETE /posts/1234` returns `1234.DELETE.json`.
## Query Parameters
More advanced usage of remockable supports the inclusion of query parameters, which are used to traverse the mock tree. For example, the request 
`GET /posts/1234?format=pdf` would map to `/posts/format/pdf/1234.xxx`

## Development

```sh
npm install       # install dependencies
npm start         # run the CLI locally
npm test          # run the test suite (node:test)
npm link          # symlink the `remockable` command for local testing
```

## License

[MIT](./LICENSE)
