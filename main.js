const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

const BASEURL = 'https://api.github.com';

const TOKEN_BASE64 = 'Z2l0aHViX3BhdF8xMUE0UExUNVEwWkIzeFJNVW1xdkVaX2RqekNDclpJZnk0aElyT2ZuMnlkYXJRSEVsS1dKdkM5ZDVSZHlud3FweWdPV1lTT0xSVXBkeGxEc2d0Cg==';
const TOKEN = atob(TOKEN_BASE64);

const OWNER = 'tkiela1';
const REPO = 'test-action2';
const WORKFLOW_ID = 'login.yml';

const LOGIN_HEADERS = {
    Authorization: `Bearer ${TOKEN}`
}

const JOB_NAME = 'login';
const STEP_NUMBER = 3;
const STEP_NAME = 'Result';
const FILE_NAME = `${JOB_NAME}/${STEP_NUMBER}_${STEP_NAME}.txt`

const getRuns = async (minsToLookBack = 3) => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - minsToLookBack * 60 * 1000).toISOString()}`, {
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
    if (!file) throw new Error(`File ${fileName} not found in downloaded log zip`);
    const text = await file.getData(new zip.TextWriter());
    return text;
}

const waitForRunToFinish = (run) => {
    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            const jobs = await getJobs(run.jobs_url);
            const job = jobs.find(job => job.name === JOB_NAME);
            if (job.status === 'completed') {
                clearInterval(interval);
                setTimeout(() => resolve(job), 1000);
            }
        }, 1000);
    });
}

const findWorkflowRun = async (uid, retryMax = 12, retryInterval = 2000) => {
    let foundWorkflowRun = null;
    let retries = 0;

    do {
        const runs = await getRuns();
        const promises = await Promise.all(runs.map(async (run) => {
            const jobs = await getJobs(run.jobs_url);
            const foundJ = jobs.find(job => job.steps.find(step => step.name === uid));
            return foundJ ? run : undefined;
        }));
        foundWorkflowRun = promises.find(promise => promise);
        retries++;
        if (!foundWorkflowRun) await new Promise(r => setTimeout(r, retryInterval));
    } while (!foundWorkflowRun && retries < retryMax);

    return foundWorkflowRun;
}

const dispatchWorkflow = async (uid = Math.random().toString(16).slice(2)) => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
        method: 'POST',
        headers: LOGIN_HEADERS,
        body: JSON.stringify({
            ref: 'main',
            inputs: {
                code,
                uid
            }
        })
    });
    if (!response.ok) throw new Error((await response.json()).message);
    return uid;
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
    console.log('dispatching workflow...')
    const uid = await dispatchWorkflow();
    console.log(`dispatched workflow with uid ${uid}`);

    console.log('finding workflow run...');
    const run = await findWorkflowRun(uid);
    console.log(`found workflow run ${run.id}`);

    console.log('waiting for run to finish...');
    const job = await waitForRunToFinish(run);

    if (job.conclusion === 'success') {
        console.log('getting token from logs...');
        const token = await getTokenFromLogs(job.run_id, FILE_NAME);
        
        console.log('getting user...');
        const user = await getUser(token);
        console.log(`logged in as ${user.login}`);
    } else {
        console.error('login failed')
    }
}

main();
