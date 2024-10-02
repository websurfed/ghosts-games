const sqlite3 = require('sqlite3').verbose();

const user_db = new sqlite3.Database('./genieUsers.db', (err) => {
  if (err) {
    console.error('couldnt clear database cuz🔥💾 : ', err.message);
  } else {
    console.log('connected to da database ✅💾');
    
    // Delete all rows in the users table but keep the structure
    user_db.run(`DELETE FROM users`, (err) => {
      if (err) {
        console.error('couldnt clear the database after connection💾❌ :', err.message);
      } else {
        console.log('accounts cleared 🔥');
      }
    });
  }
});

user_db.close((err) => {
  if (err) {
    console.error('couldnt close database🚪 : ', err.message);
  } else {
    console.log('connection closed ❌');
  }
});
