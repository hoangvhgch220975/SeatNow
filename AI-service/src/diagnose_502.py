import sys
try:
    import pymongo
    print(f"DEBUG: pymongo version {pymongo.version}")
except ImportError:
    print("DEBUG: pymongo is NOT installed")

from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGO_URI")

if uri:
     try:
         client = MongoClient(uri, serverSelectionTimeoutMS=5000)
         print(f"DEBUG: MongoDB connection string found: {uri[:20]}...")
         client.admin.command('ping')
         print("DEBUG: MongoDB Ping successful")
     except Exception as e:
         print(f"DEBUG: MongoDB Connection failed: {e}")
else:
    print("DEBUG: MONGO_URI not found in .env")

import pyodbc
_SERVER    = os.getenv("DB_SERVER", "(localdb)\\MSSQLLocalDB")
_DATABASE  = os.getenv("DB_NAME", "SeatNow")
try:
    conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={_SERVER};DATABASE={_DATABASE};Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;"
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 COLLATE Vietnamese_CI_AI")
    print("DEBUG: MSSQL Collation Vietnamese_CI_AI is SUPPORTED")
except Exception as e:
    print(f"DEBUG: MSSQL Collation check failed: {e}")
