const sqlite3 = require('sqlite3').verbose();

// Initialize the SQLite3 database
const db = new sqlite3.Database('./responses.db');

async function clearResponses() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM responses', function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes); // Returns the number of rows deleted
      }
    });
  });
}

clearResponses()
  .then(deletedCount => {
    console.log(`cleared da database of ${deletedCount} responses 💾🥳🎈🎉`);
    db.close(); // Close the database connection
  })
  .catch(error => {
    console.error("this error happened ⛔; ", error, " ... oh well 🤷‍♂️");
    db.close(); // Close the database connection
  });
