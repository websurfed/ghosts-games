const sqlite3 = require('sqlite3').verbose();

const user_db = new sqlite3.Database('./genieUsers.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    // Check if the users table exists and has the 'cookie' column
    user_db.all("PRAGMA table_info(users)", (err, columns) => {  // Change from `get` to `all`
      if (err) {
        console.error('Error retrieving table info:', err.message);
        return;
      }

      // Check if the cookie column exists
      const hasCookieColumn = columns.some(column => column.name === 'cookie');

      if (!hasCookieColumn) {
        // Create a new table with the correct structure
        user_db.run(`
          CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            cookie TEXT NOT NULL,
            username TEXT NOT NULL,
            challenges_completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating new table:', err.message);
            return;
          }

          // Copy existing data to the new table
          user_db.run(`
            INSERT INTO users_new (id, username, challenges_completed, created_at)
            SELECT id, username, challenges_completed, created_at FROM users
          `, (err) => {
            if (err) {
              console.error('Error copying data to new table:', err.message);
              return;
            }

            // Drop the old table
            user_db.run("DROP TABLE users", (err) => {
              if (err) {
                console.error('Error dropping old table:', err.message);
                return;
              }

              // Rename the new table to the original name
              user_db.run("ALTER TABLE users_new RENAME TO users", (err) => {
                if (err) {
                  console.error('Error renaming new table:', err.message);
                  return;
                }
                console.log('Table updated successfully with cookie column.');
              });
            });
          });
        });
      } else {
        console.log('Table already exists with the cookie column.');
      }
    });
  }
});
