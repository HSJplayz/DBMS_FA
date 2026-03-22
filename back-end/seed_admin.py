import mysql.connector
import bcrypt

hashed = bcrypt.hashpw(b'123', bcrypt.gensalt()).decode()
con = mysql.connector.connect(
    host='localhost', port=3306,
    user='root', password='itsmyaccount233',
    database='recipe'
)
cur = con.cursor()
cur.execute(
    "INSERT INTO users (name, email, password, is_admin) VALUES (%s, %s, %s, 1) "
    "ON DUPLICATE KEY UPDATE is_admin=1, password=%s",
    ('Admin', 'admin@gmail.com', hashed, hashed)
)
con.commit()
print('Admin seeded OK. Rows affected:', cur.rowcount)
cur.close()
con.close()
