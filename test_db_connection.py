import mysql.connector
from mysql.connector import Error

def check_mysql():
    try:
        con = mysql.connector.connect(
            host='localhost',
            port=3306,
            user='root',
            password='itsmyaccount233'
        )
        if con.is_connected():
            print("Successfully connected to MySQL server")
            cursor = con.cursor()
            cursor.execute("SHOW DATABASES;")
            databases = cursor.fetchall()
            print("Databases:", [db[0] for db in databases])
            con.close()
    except Error as e:
        print("Error while connecting to MySQL:", e)

if __name__ == "__main__":
    check_mysql()
