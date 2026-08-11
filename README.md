# remockable

Remockable is a tiny, filesystem-driven HTTP mock server. Create files and
folders that mirror your API, run one command, and start making requests — no
configuration files and no JavaScript required. The directory tree _is_ the
configuration.

## Quick Start

Create a directory tree that mirrors the API you want to mock:

```
mocks/
└── users/
    ├── index.json
    ├── index.POST.json
    ├── 123.json
    └── 123.DELETE.json
```

Serve it:

```sh
npx @smeans/remockable ./mocks
```

Now the filesystem answers your requests:

```
GET    /users      -> users/index.json
POST   /users      -> users/index.POST.json
GET    /users/123  -> users/123.json
DELETE /users/123  -> users/123.DELETE.json
```

That's the whole idea: `mkdir` + response files + `remockable`.

## Installation

Install globally to get the `remockable` command:

```sh
npm install -g @smeans/remockable
```

Or run it once without installing:

```sh
npx @smeans/remockable
```

After a global install, use the short executable name:

```sh
remockable                 # serve the mocks tree from the current directory
remockable ./mocks         # serve the mocks tree from ./mocks
remockable --help
remockable --version
```

## How Routing Works

A request maps to a file inside the mocks tree. The URL path selects the
directory and the resource name; the file that answers it lives in that
directory.

### Directory indexes

A request for a folder returns its `index` file:

```
posts/index.json    ->   GET /posts
```

### Resource files

A named file answers a request for that name:

```
posts/1234.json     ->   GET /posts/1234
```

### File extensions are optional

You may omit the extension from the URL; Remockable infers it:

```
images/logo.png     ->   GET /images/logo
```

If more than one file would match an extensionless request, the request is
**ambiguous** and returns `404`. For example, with both:

```
logo.png
logo.svg
```

the request `GET /logo` returns `404` rather than picking one arbitrarily.
Request the file with its extension (`GET /logo.png`) to disambiguate.

## HTTP Methods

The HTTP method is encoded as a token in the filename, inserted _before_ the
content extension:

```
posts/index.POST.json      ->   POST /posts
posts/1234.DELETE.json     ->   DELETE /posts/1234
```

The same pattern works for `PUT`, `PATCH`, `OPTIONS`, and others.

### GET and default files

`GET` is special: a verbless file is the default representation.

- `foo.GET.json` is the explicit `GET` response and **takes precedence** over
  `foo.json`.
- `foo.json` is the fallback used for `GET` when no explicit `.GET` file exists.

So resolution is deterministic regardless of directory order:

| Files present                 | `GET /foo` returns |
| ----------------------------- | ------------------ |
| `foo.json`                    | `foo.json`         |
| `foo.GET.json`                | `foo.GET.json`     |
| `foo.json` and `foo.GET.json` | `foo.GET.json`     |

`HEAD` is resolved like `GET` (the body is omitted from the response).

## Content Types

The response `Content-Type` is derived from the file extension (for example
`.json` → `application/json`, `.png` → `image/png`). Unknown extensions fall
back to `application/octet-stream`.

## Query Parameters

Query parameters traverse deeper into the tree. Each parameter inserts segments
between the resource's directory and its resource name:

- a `key=value` pair inserts two segments: `key` then `value`
- a valueless flag (`?draft`) inserts one segment: `key`

For example:

```
GET /posts/1234?format=pdf     ->   posts/format/pdf/1234.*
```

Multiple parameters are inserted in the order they appear in the URL, so
**order matters**:

```
GET /posts?a=1&b=2     ->   posts/a/1/b/2/index.*
GET /posts?b=2&a=1     ->   posts/b/2/a/1/index.*
```

These are different paths. If you rely on query traversal, name your
directories in a consistent parameter order.

## CLI Options

```sh
remockable [folder] [options]
```

| Option              | Description                              | Default   |
| ------------------- | ---------------------------------------- | --------- |
| `-p, --port <port>` | Port to listen on                        | `3333`    |
| `-H, --host <ip>`   | IP address / hostname to bind the server | `0.0.0.0` |

By default the server binds to `0.0.0.0`, so it is reachable from other devices
on your network (phones, tablets, VMs). To restrict it to your machine, bind to
localhost:

```sh
remockable --host 127.0.0.1
remockable ./mocks --port 8080 --host 127.0.0.1
```

## Errors

Remockable keeps error behavior deliberately simple. Unresolved, ambiguous,
hidden, or unsafe paths return a plain `404` (or `400` for a malformed URL).
Hidden files (names beginning with `.`) are never served, and `..` / path
traversal attempts are rejected.

## Development

```sh
npm install       # install dependencies
npm start         # run the CLI locally
npm test          # run the test suite (node:test)
npm link          # symlink the `remockable` command for local testing
```

## License

[MIT](./LICENSE)
