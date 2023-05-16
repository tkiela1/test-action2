// get the code from the url param
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

// make HTTP POST request
const data = {
    ref: 'main',
    inputs: {
        code: code
    }
}

const TOKEN = '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';
const BASEURL = 'https://api.github.com';
const OWNER = 'austenstone';
const REPO = 'github-actions-oauth';
const WORKFLOW_ID = 'login.yml';

fetch(`${BASEURL}/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
    method: 'POST',
    headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify(data)
}).then(response => response.json()).then(data => {
    console.log('done!')
    console.log(data);
    // save the token in local storage
    localStorage.setItem('token', data.token);
    // redirect to the home page
    // window.location.href = '/';
});