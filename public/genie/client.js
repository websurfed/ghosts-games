let selectedMode = "";
let allowedToSend = false;

const predictModeButton = document.getElementById("predict-mode");
const wishModeButton = document.getElementById("wish-mode");

const outcomeText = document.getElementById("guessing-text");

const wishInput = document.getElementById("wish-text");
const wishGrant = document.getElementById("grant-wish");

const loadingCover = document.getElementById("loading-cover");
const centerMoji = document.getElementById("center-moji");

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
  wishModeButton.classList.add("selected");
  predictModeButton.classList.remove("selected");
});

predictModeButton.addEventListener("click", () => {
  selectedMode = "predict";
  predictModeButton.classList.add("selected");
  wishModeButton.classList.remove("selected");
});

selectedMode = "predict";
predictModeButton.classList.add("selected");
wishModeButton.classList.remove("selected");

wishInput.addEventListener("input", () => {
  if (wishInput.value.trim() === "") {
    allowedToSend = false;
    wishGrant.className = "wishgrant nope";
  } else {
    allowedToSend = true;
    wishGrant.className = "wishgrant";
  }
});

wishGrant.addEventListener("click", () => {
  if (allowedToSend) {
    const wishes = JSON.parse(localStorage.getItem(wishesKey));

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
            loadingCover.className = "cover hidden"; // Hide loading cover after response
            updateWishes();
          })
          .catch((error) => {
            outcomeText.textContent = error;
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
          const prediction = data.prediction.trim();
          const firstMoji = prediction.match(/^\p{Emoji}/u) ? prediction.match(/^\p{Emoji}/u)[0] : ''; // Matches the first emoji
          const restOfResponse = prediction.slice(firstMoji.length).trim(); // Remove the first emoji

          outcomeText.textContent = restOfResponse;
          centerMoji.textContent = firstMoji;

          loadingCover.className = "cover hidden"; // Hide loading cover after response
        })
        .catch((error) => {
          outcomeText.textContent = error;
          loadingCover.className = "cover hidden";
        });
    }
  }
});



// Initial state check for the button
if (wishInput.value.trim() === "") {
  allowedToSend = false;
  wishGrant.className = "wishgrant nope";
} else {
  allowedToSend = true;
  wishGrant.className = "wishgrant";
}

initializeWishes();