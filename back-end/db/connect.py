import mysql.connector
from mysql.connector import Error

def connectDb():
    try:
        con = mysql.connector.connect(
            host='localhost',
            port=3306,
            user='root',
            password='itsmyaccount233',
            database='recipe',
        )
        return con
    except Error as e:
        print("Error while connecting to db:", e)
        return None