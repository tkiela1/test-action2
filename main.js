// get the code from the url param
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

const BASEURL = 'https://api.github.com';
// This TOKEN is a fine-grained PAT with ONLY actions:write permissions on ONLY a single repo
const TOKEN = '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';
const OWNER = 'austenstone';
const REPO = 'github-actions-oauth';
const WORKFLOW_ID = 'login.yml';

fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
    method: 'POST',
    headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
        ref: 'main',
        inputs: {
            code: code
        }
    })
}).then(data => {
    // in a loop get the runs that have been created since now minus 5 minutes (the delta is to avoid any issue with timings): using GET https://api.github.com/repos/$OWNER/$REPO/actions/runs?created=>$run_date_filter
    fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - 3 * 60 * 1000).toISOString()}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${TOKEN}`
        }
    }).then(response => response.json()).then(async data => {
        console.log(data.workflow_runs);
        for (const run of data.workflow_runs) {
            console.log('getting', run)
            await fetch(run.jobs_url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${TOKEN}`
                }
            }).then(response => response.json()).then(data => {
                console.log(data);
                data.jobs.forEach(job => {
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
                })
            });
        }
    });
});
