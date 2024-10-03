const path = window.location.pathname;
const usernameWithAt = path.split('/u/')[1];

let userId = ""

function formatDate(dateString) {
  const date = new Date(dateString);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

if (usernameWithAt && usernameWithAt.startsWith('@')) {
  const username = usernameWithAt.slice(1);

  document.title = `Genie - @${username}`;
  
  fetch(`/genie/users/${username}`)
    .then(res => res.json())
    .then(user => {
      document.getElementById('id-text').textContent = `id: ${user.id}`
      userId = user.id

      document.getElementById('usr-name').textContent = `@${user.username}`

      document.getElementById('pfp-img').src = user.profile_pic

      document.getElementById('create-text').textContent = `created: ${formatDate(user.creation)}`
    })
    .catch(err => console.error(err));
} else {
  alert('invalid username ❌')
}

async function copyId() {
  try {
    await navigator.clipboard.writeText(userId);
  } catch (err) {
    alert('cant copy to clipboard 📋')
    console.error("couldnt copy cuz: ", err);
  }
}

function redirectEditPage() {
  window.location = "/genie/s/edit"
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

async function checkAccount() {
  const userCookie = getCookie('genieSession');
  if (userCookie) {
    try {
      const response = await fetch(`/genie/get/account?c=${userCookie}`);
      const data = await response.json();
      if (data.id && data.username && data.challenges_completed !== undefined) {
        const { username } = data;
        return username;
      } else {
        alert('😞 something went wrong while retrieving your account info.');
        return null;
      }
    } catch {
      alert('⚠️ failed to fetch account data. please try again later.');
      return null;
    }
  }
  return null;
}

(async () => {
  const username = await checkAccount();
  if (username && username === usernameWithAt.slice(1)) {
    document.getElementById('edit-acc-div').className = "edit-acc"
  }
})();
