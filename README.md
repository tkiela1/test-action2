# GitHub Pages OAuth using Actions

I wanted to perform GitHub OAuth from GitHub Pages but we can't expose the App's client secret. This means we need a backend service to authenticate with. We could use lambda functions or just spin up a server but I wanted to use ONLY GitHub products.

And so the idea was to run authentication within GitHub Actions!

# Call a Workflow like a lambda function
The first step is to figure out how to run a workflow like a lambda function. 

## Permissions

So our first problem is that we need to authenticate to call the workflow API but Actions is our authentication.

[Fine Grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token)s can scope permissions to ONLY a single repo with ONLY actions permissions. As long as we don't put anything sensetive in this repo it should be OK to share this PAT publicly.

So great we commit our fine grained PAT to the code in our repo but it immedietly goes to expired. This is GitHub Secret Scanning trying to protect you. To get around this we can base64 encode/decode our PAT.

> **Warning**
> This can technically be abused as this token could be extracted from the code and then used manually to lookup other user's workflow runs. These workflow runs contain the user token which should not be shared. This is why this solution should only be used in cases were this scenario is palletable. Let's say internally in a private repo.

## `workflow_dispatch`

We have the [`workflow_dispatch`](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch) as a starting point.

Let's first start by creating a workflow file `api.yml`:
```yml
name: API

on:
  workflow_dispatch:

jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - run: echo Hello World!
```

Now we can dispatch this workflow using the API [`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`]()!

This is great but we have a huge issue. The run id used in subsequent requests is not returned to us!

## Dealing with missing run id

So because we don't have any ID we will have to poll the API for the workflow. We can doing this using [`/repos/${OWNER}/${REPO}/actions/runs`]().

To filter our result even further we can use the created parameter. Let's say any workflows in the last 5 minutes.
`/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`.

This will return all the workflows in the last five minutes but how do we know which ones are ours?!

## Finding the associated workflow

So to find the associated workflow we're going to have to get cleaver. We need some unique identifier that can be retreived via the API.

We have the `jobs_url` in the response from the runs API but we can't see any inputs/outputs we passed in. Only the names of the steps and their conclusion.

It just so happens the name of a step can be variable so let's modify our workflow to put a unique identifier in the step name!

```yml
name: API

on:
  workflow_dispatch:
    inputs:
      uid:
        description: 'Unique ID for the request'
        required: true

jobs:
  login:
    runs-on: ubuntu-latest
    hello:
      - name: ${{ inputs.uid }}
        run: echo Hello World!
```

So let's break down what we're doing so far:
1. GET [`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`]() again but this time pass a unique id as the input `uid`.
2. Poll [`/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - 5 * 60 * 1000).toISOString()`]() to find new runs in the last five minutes.
3. Using the response itterate the runs and call GET `jobs_url` from the run object.
4. Using the response itterate the steps to find the one where `name === uid`

And perfect we have a way to dispatch a workflow, get associated workflow, and wait for it to finish. But what about the data? How do we get the output?

## Getting the workflow output

So now that we have the workflow run we need to get some output. The best way to do this is the log output. We can fetch the logs using [`/repos/${OWNER}/${REPO}/actions/runs/${RUN_ID}/logs`]().

This API will redirect us to a zip file. We can download this zip file and get our final output!

# GitHub OAuth

Okay so now we have Actions acting as our "backend service" so let's implement [OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authenticating-to-the-rest-api-with-an-oauth-app).

Start by [creating a GitHub App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app). Use the same redirect URL as the HTTP server where you are doing development. This could be localhost or GitHub Pages.

We need to direct the user to `/login/oauth/authorize?scope=user:email&client_id=${CLIENT_ID}` where `${CLIENT_ID}` is the client_id from our GitHub App.

After approval the user will be redirect back to the redirect URL you specified with a new URL parameter `code` which is used in subsequent requests.

Let's create a basic `index.html` file with a login link using our client id:
```html
<html>
  <head>
    <script src="zip.js"></script>
    <script src="main.js"></script>
  </head>
  <body>
    <p>
      Well, hello there!
    </p>
    <p>
      We're going to now talk to the GitHub API. Ready?
      <a href="https://github.com/login/oauth/authorize?scope=user:email&client_id=Iv1.bc38b449a74116b3">Click here</a> to begin!
    </p>
    <p>
      If that link doesn't work, remember to provide your own <a href="/apps/building-oauth-apps/authorizing-oauth-apps/">Client ID</a>!
    </p>
  </body>
</html>
```

You now need to parse the code and from the URL parameter.

Now the next request to get our token requires the `CLIENT_SECRET` which can't be stored on the front end. This is where the GitHub Actions solution we takled about before comes in.

Let's update our workflow file to include the login. We need a new input code and some logic to perform the login request. Then we simply print the token to the logs so we can grab it later.
```yml
name: Login

on:
  workflow_dispatch:
    inputs:
      code:
        description: 'Temporary GitHub code from App authorization'
        required: true
      uid:
        description: 'Unique ID for the request'
        required: true

jobs:
  login:
    runs-on: ubuntu-latest
    outputs:
      token: ${{ steps.login-script.outputs.result }}
    steps:
      - name: ${{ inputs.uid }}
        uses: actions/github-script@v6
        id: login-script
        env:
          code: ${{ inputs.code }}
          client_id: ${{ secrets.CLIENT_ID }}
          client_secret: ${{ secrets.CLIENT_SECRET }}
        with:
          script: |
            const { code, client_id, client_secret } = process.env;
            const response = await fetch("https://github.com/login/oauth/access_token", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({
                client_id,
                client_secret,
                code
              }),
            });
            result = await response.json();
            const token = result.access_token
            if (!token) core.setFailed(result.error_description);
            return {
              token: btoa(token)
            };
      - name: Result
        run: printf '${{ steps.login-script.outputs.result }}'
```

So now we can call GET [`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`]() again but this time pass the installation code as the input `code`. The result of the workflow should contain a GitHub token with the requested permissions.

That's it! Now you have a token and can create whatever you'd like in GitHub Pages using the GitHub API.
