# GitHub Pages OAuth using Actions

I wanted to perform GitHub OAuth from GitHub Pages but we can't expose the App's client secret. This means we need a backend service to authenticate with. We could use lambda functions or just spin up a server but I wanted to use ONLY GitHub products.

And so the idea to run authentication within GitHub Actions!

# Call a Workflow like a lambda function
The first step is to figure out how to run a workflow like a lambda function. 

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
