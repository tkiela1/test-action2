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
}).then(response => response.json()).then(data => {
    console.log('done!')
    console.log(data);
    // save the token in local storage
    localStorage.setItem('token', data.token);
    // redirect to the home page
    // window.location.href = '/';
});

// in a loop get the runs that have been created since now minus 5 minutes (the delta is to avoid any issue with timings): using GET https://api.github.com/repos/$OWNER/$REPO/actions/runs?created=>$run_date_filter
fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/runs?created=>${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`, {
    method: 'GET',
    headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${TOKEN}`
    }
}).then(response => response.json()).then(data => {
    console.log(data);
});
