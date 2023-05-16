const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

const BASEURL = 'https://api.github.com';
const TOKEN_BASE64 = 'Z2l0aHViX3BhdF8xMUFGTEM2NlkwYVhuU1JUMlhsOFNkXzI3Qk5WN2tkZXlGampMSjlaUkdmNUpNclU5Yk5laWV3YjAya05NdGM5ODNXM0FJWjVBR3JIVXl1azM5';
const TOKEN = atob(TOKEN_BASE64);
const OWNER = 'austenstone';
const REPO = 'github-actions-oauth';
const WORKFLOW_ID = 'login.yml';
const LOGIN_HEADERS = {
    Authorization: `Bearer ${TOKEN}`
}

const JOB_NAME = 'login';
const STEP_NUMBER = 3;
const STEP_NAME = 'Result';
const FILE_NAME = `${JOB_NAME}/${STEP_NUMBER}_${STEP_NAME}.txt`

const MINS_TO_LOOK_BACK = 2;
const getRuns = async () => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - MINS_TO_LOOK_BACK * 60 * 1000).toISOString()}`, {
        method: 'GET',
        headers: LOGIN_HEADERS
    });
    const data = await response.json();
    return data.workflow_runs;
}

const getJobs = async (jobsUrl) => {
    const response = await fetch(jobsUrl, {
        method: 'GET',
        headers: LOGIN_HEADERS,
        cache: 'no-cache'
    });
    const data = await response.json();
    return data.jobs;
}

const getUser = async (token) => {
    const response = await fetch(`${BASEURL}/user`, {
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`
        }
    });
    const data = await response.json();
    return data;
}

const getWorkflowRunLogs = async (runId, fileName) => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs/${runId}/logs`, {
        method: 'GET',
        headers: LOGIN_HEADERS
    });
    const blob = await response.blob();
    const files = await (new zip.ZipReader(new zip.BlobReader(blob))).getEntries({ filenameEncoding: "utf-8" });
    const file = files.find(file => file.filename === fileName);
    const text = await file.getData(new zip.TextWriter());
    return text;
}

const maxRetries = 12;
const retryInterval = 5000;
const findJob = async () => {
    let foundJob = null;
    let retries = 0;

    while (foundJob === null && retries < maxRetries) {
        const runs = await getRuns();
        for (const run of runs) {
            const jobs = await getJobs(run.jobs_url);
            for (const job of jobs) {
                console.log(`Job ${job.name} is`, job)
                if (job.conclusion === 'success') {
                    const loginStep = job.steps.find(step => step.name === 'Login');
                    if (loginStep.conclusion === 'success') {
                        console.log('Login successful 🥳');
                    } else {
                        console.log('Login failed!');
                    }
                } else if (job.conclusion === 'failure') {
                    console.log('Job failed!')
                } else {
                    console.log('Job is still running...');
                }
                if (job.conclusion === 'success') {
                    foundJob = job;
                    break;
                }
            }
            if (foundJob) break;
        }
        if (foundJob) break;
        retries++;
        await new Promise(r => setTimeout(r, retryInterval));
    }
    return foundJob;
}

const dispatchWorkflow = async () => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
        method: 'POST',
        headers: LOGIN_HEADERS,
        body: JSON.stringify({
            ref: 'main',
            inputs: {
                code: code
            }
        })
    });
    if (!response.ok) throw new Error((await response.json()).message);
    return response;
}

const getTokenFromLogs = async (runId, fileName) => {
    const runLogs = await getWorkflowRunLogs(runId, fileName);
    const start = '{"token":"'
    const end = '"}'
    const match = runLogs.match(new RegExp(start + ".*" + end));
    const tokenResponseRaw = match[0];
    if (tokenResponseRaw) {
        const tokenResponse = JSON.parse(tokenResponseRaw)
        tokenResponse.token = atob(tokenResponse.token);
        const token = tokenResponse.token;
        return token;
    }
}

const main = async () => {
    await dispatchWorkflow();
    const job = await findJob();
    if (job) {
        const token = await getTokenFromLogs(job.run_id, FILE_NAME);
        const user = await getUser(token);
        console.log(user);
    }
}

main();
