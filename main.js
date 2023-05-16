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

const findJob = async () => {
    let foundJob = null;
    let retries = 0;
    while (foundJob === null && retries < 5) {
        const runs = await getRuns();
        console.log('runs', runs)
        for (const run of runs) {
            console.log('getting', run)
            const jobs = await getJobs(run.jobs_url);
            for (const job of jobs) {
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
    if (!response.ok) throw new Error(response.statusText);
    return response;
}

const main = async () => {
    await dispatchWorkflow();
    const job = await findJob();
    console.log('FOUD JOB:', job);
    if (job) {
        const step = job.steps.find(step => step.name === 'Login');
        if (step) {
            console.log('STEP:', step);
        }
    }
}

main();
