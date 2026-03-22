import mysql.connector

con = mysql.connector.connect(
    host='localhost', port=3306,
    user='root', password='itsmyaccount233',
    database='recipe'
)
cur = con.cursor()

# Disable FK checks
cur.execute("SET FOREIGN_KEY_CHECKS=0")

# Add AUTO_INCREMENT to recipe (max id = 2141272)
cur.execute("ALTER TABLE recipe MODIFY id INT NOT NULL AUTO_INCREMENT")
cur.execute("ALTER TABLE recipe AUTO_INCREMENT = 2141273")
print("recipe table: AUTO_INCREMENT added")

# Add AUTO_INCREMENT to ingredient (max id = 3156308)
cur.execute("ALTER TABLE ingredient MODIFY id INT NOT NULL AUTO_INCREMENT")
cur.execute("ALTER TABLE ingredient AUTO_INCREMENT = 3156309")
print("ingredient table: AUTO_INCREMENT added")

# Re-enable FK checks
cur.execute("SET FOREIGN_KEY_CHECKS=1")

con.commit()
cur.close()
con.close()
print("All done!")
