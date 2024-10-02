let selectedMode = "";
let predictingRequest = false;
let allowedToSend = false;

const predictModeButton = document.getElementById("predict-mode");
const wishModeButton = document.getElementById("wish-mode");

const outcomeText = document.getElementById("guessing-text");
const usesText = document.getElementById("uses");

const wishInput = document.getElementById("wish-text");
const wishGrant = document.getElementById("grant-wish");

const loadingCover = document.getElementById("loading-cover");
const centerMoji = document.getElementById("center-moji");

const accountDiv = document.getElementById("account-div")
const userField = document.getElementById("account-input-field")
const atTag = document.getElementById('at-tag')
const createButton = document.getElementById("acc-button")

const maxWishes = 3;
const wishesKey = 'dailyWishes';
const resetTimeKey = 'resetTime';

function initializeWishes() {
  const currentTime = new Date().getTime();
  const resetTime = localStorage.getItem(resetTimeKey);

  if (!resetTime || currentTime > resetTime) {
    localStorage.setItem(wishesKey, JSON.stringify({ count: 0 }));
    localStorage.setItem(resetTimeKey, currentTime + 24 * 60 * 60 * 1000);
  }
}

console.log(window.location.hash)
if (window.location.hash === "#wish") {
  selectedMode = "wish";
  wishModeButton.classList.add("selected");
  predictModeButton.classList.remove("selected");
} else if (window.location.hash === "#predict") {
  selectedMode = "predict";
  predictModeButton.classList.add("selected");
  wishModeButton.classList.remove("selected");
}

function updateWishes() {
  const wishes = JSON.parse(localStorage.getItem(wishesKey));

  if (wishes.count < maxWishes) {
    wishes.count++;
    localStorage.setItem(wishesKey, JSON.stringify(wishes));
    return true;
  } else {
    return false;
  }
}

function displayTimeUntilReset() {
  const resetTime = localStorage.getItem(resetTimeKey);
  const currentTime = new Date().getTime();
  const timeLeft = resetTime - currentTime;

  if (timeLeft > 0) {
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    outcomeText.textContent = `uh oh, you ran out of wishes for today! 🫨🌟 it resets in ${hours}h ${minutes}m ${seconds}s ⌛`;
  }
}

wishModeButton.addEventListener("click", () => {
  selectedMode = "wish";
  window.location.hash = "wish";
  wishModeButton.classList.add("selected");
  predictModeButton.classList.remove("selected");
});

predictModeButton.addEventListener("click", () => {
  selectedMode = "predict";
  window.location.hash = "predict";
  predictModeButton.classList.add("selected");
  wishModeButton.classList.remove("selected");
});

if (selectedMode === "") {
  selectedMode = "predict";
  predictModeButton.classList.add("selected");
  wishModeButton.classList.remove("selected");
}

wishInput.addEventListener("input", () => {
  if (wishInput.value.trim() === "") {
    allowedToSend = false;
    wishGrant.className = "wishgrant nope";
  } else {
    allowedToSend = true;
    wishGrant.className = "wishgrant";
  }
});

function wishGranter() {
  if (allowedToSend && predictingRequest === false) {
    const wishes = JSON.parse(localStorage.getItem(wishesKey));
    predictingRequest = true;

    if (selectedMode === "wish") {
      if (wishes.count < maxWishes) {
        const wish = wishInput.value.trim();
        const endpoint = "/wish";
        loadingCover.className = "cover"; // Show loading cover

        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wish }),
        })
          .then((response) => response.json())
          .then((data) => {
            outcomeText.textContent = data.outcome;
            usesText.textContent = data.uses;

            const uses = data.uses - 1
            if (uses === 0) {
              usesText.textContent = `🧠⌛ you're the first person to ask '${data.wish}'`;
            } else {
              usesText.textContent = `🧠⌛ this has been asked ${uses} other times`;
            }
            loadingCover.className = "cover hidden"; // Hide loading cover after response
            updateWishes();
          })
          .catch((error, data) => {
            outcomeText.textContent = data;
            loadingCover.className = "cover hidden";
          });
      } else {
        displayTimeUntilReset(); // Show message if out of wishes
      }
    } else if (selectedMode === "predict") {
      const wish = wishInput.value.trim();
      const endpoint = "/predict";
      loadingCover.className = "cover"; // Show loading cover

      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wish }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.failed === true) {
            alert(data.reason)
            loadingCover.className = "cover hidden"

            return
          }

          const prediction = data.prediction.trim();
          const firstMoji = prediction.match(/^\p{Emoji}/u) ? prediction.match(/^\p{Emoji}/u)[0] : '';
          const restOfResponse = prediction.slice(firstMoji.length).trim();

          const uses = data.uses - 1

          outcomeText.textContent = restOfResponse;
          centerMoji.textContent = firstMoji;
          if (uses === 0) {
            usesText.textContent = `🧠⌛ you're the first person to ask '${data.wish}'`;
          } else {
            usesText.textContent = `🧠⌛ this has been asked ${uses} other times`;
          }

          usesText.className = "uses";
          loadingCover.className = "cover hidden"; 
        })
        .catch(async (error) => {
          console.error(error)
          outcomeText.textContent = 'uh oh, something went wrong 😕';
          usesText.className = "uses hidden";

          centerMoji.textContent = '🐌';
          loadingCover.className = "cover hidden";
        });
      
    }
    
    predictingRequest = false;
  }
}

wishGrant.addEventListener("click", () => {
  wishGranter()
});

wishInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter" && wishInput.value.trim() !== "" && document.activeElement === wishInput) {
    wishGranter();
  }
});

if (wishInput.value.trim() === "") {
  allowedToSend = false;
  wishGrant.className = "wishgrant nope";
} else {
  allowedToSend = true;
  wishGrant.className = "wishgrant";
}

initializeWishes();

function checkAccountInput() {
  const inputValue = userField.value;
  const accReason = document.getElementById('acc-reason');
  let invalidReason = "";

  if (inputValue === "") {
    atTag.className = "at-tag";
    invalidReason = "❌ cannot be empty";
  } else if (inputValue.length < 3) {
    atTag.className = "at-tag";
    invalidReason = "❌ must be at least 3 characters";
  } else if (inputValue.length > 20) {
    atTag.className = "at-tag";
    invalidReason = "❌ cannot exceed 20 characters";
  } else if (!/^[A-Za-z]/.test(inputValue)) {
    atTag.className = "at-tag";
    invalidReason = "❌ must start with a letter";
  } else if (!/^[A-Za-z0-9]*$/.test(inputValue)) {
    atTag.className = "at-tag";
    invalidReason = "❌ can only contain letters and numbers";
  } else {
    atTag.className = "at-tag typed";
    invalidReason = "";
  }

  accReason.innerText = invalidReason.toLowerCase();
}

async function createAccount() {
  const hCaptcha = document.getElementById('h-captcha');
  const inputValue = userField.value;
  const isValidInput = /^[A-Za-z][A-Za-z0-9]{2,19}$/.test(inputValue);

  const id = hcaptcha.getResponse()
  
  if (id === "") {
    alert('complete the captcha to continue 🧠')
    console.error('captcha not completed ⛔')
  } else {
    if (isValidInput) {
      try {
        const response = await fetch('/genie/create/account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: userField.value, captchaid: id }),
        });

        if (!response.ok) {
          alert(`couldnt send the request to the server 🔥`)
          console.error(`failed to send, status❌ : ${response.status}`)
          return
        }

        const responseData = await response.json();
        alert(responseData.response)

        // Prevent another creation:
        hcaptcha.reset()
      } catch (error) {
        alert(`error sending request 🔥`)
      }
    } else {
      hcaptcha.reset()
      alert('please meet the requirements ❌')
    }
  }
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function loadAccount() {
  const userCookie = getCookie('genieSession')
  if (userCookie) {
    fetch(`/genie/get/account?c=${userCookie}`)
    .then(response => response.json())
    .then(data => {
      if (data.id && data.username && data.challenges_completed !== undefined) {
        const { id, username, challenges_completed } = data;

        // Make changes before alerting:
        document.getElementById('my-username').textContent = `@${username}`
        document.getElementById('my-username').title = `id=${id}`
      } else {
        alert('😞 something went wrong while retrieving your account info.');
      }
    })
    .catch(() => {
      alert('⚠️ failed to fetch account data. please try again later.');
    });
  }
}

const sessionCookie = getCookie('genieSession');
if (sessionCookie) {
  console.log('has cookie 🧞🍪');
  accountDiv.className = "account-div disabled";

  loadAccount()
} else {
  console.log('needs cookie')
}