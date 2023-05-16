const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

const BASEURL = 'https://api.github.com';
const TOKEN = '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';
const OWNER = 'austenstone';
const REPO = 'github-actions-oauth';
const WORKFLOW_ID = 'login.yml';
const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${TOKEN}`
}

const getRuns = async () => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - 3 * 60 * 1000).toISOString()}`, {
        method: 'GET',
        headers
    });
    const data = await response.json();
    return data.workflow_runs;
}

const getJobs = async (jobsUrl) => {
    const response = await fetch(jobsUrl, {
        method: 'GET',
        headers
    });
    const data = await response.json();
    return data.jobs;
}

const JOB_NAME = 'login';
const STEP_NUMBER = 2;
const STEP_NAME = 'Login';
const fileName = `${JOB_NAME}/${STEP_NUMBER}_${STEP_NAME}.txt`
const getWorkflowRunLogs = async (runId) => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs/${runId}/logs`, {
        method: 'GET',
        headers
    });
    const blob = await response.blob();


    const zipEntries = (new zip.ZipReader(new zip.BlobReader(blob))).getEntries({ filenameEncoding: "utf-8" });
    const files = await zipEntries;
    const file = files.find(file => file.filename === fileName);
    const text = await file.getData(new zip.TextWriter());
    console.log('TEXT:', text);
    // console.log(response.headers.get('Location'))
    // if (response.status === 302) {
    //     const redirectUrl = response.headers.get('Location');
    //     const response = await fetch(redirectUrl, {
    //         method: 'GET',
    //         headers
    //     });
    //     const data = await response.text();
    //     return data;
    // } else {
    //     throw new Error('Failed to get logs');
    // }
}

const findJob = async () => {
    let foundJob = null;
    let retries = 0;
    while (foundJob === null && retries < 5) {
        const runs = await getRuns();
        console.log('runs', runs)
        for (const run of runs) {
            const jobs = await getJobs(run.jobs_url);
            for (const job of jobs) {
                console.log(job)
                console.log(`Job ${job.name} is ${job.conclusion}`)
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
        await new Promise(r => setTimeout(r, 5000));
    }
    return foundJob;
}

const dispatchWorkflow = async () => {
    const response = await fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
        method: 'POST',
        headers,
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

const main = async () => {
    try {
        await dispatchWorkflow();
        const job = await findJob();
        console.log('FOUD JOB:', job);
        if (job) {
            const step = job.steps.find(step => step.name === 'Login');
            if (step) {
                console.log('STEP:', step);
            }
            const runLogs = await getWorkflowRunLogs(job.run_id);
            console.log('RUN LOGS:', runLogs);
        }
    } catch (error) {
        console.error(error);
    }
}

main();
