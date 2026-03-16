import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

_DRIVER    = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
_SERVER    = os.getenv("DB_SERVER", "(localdb)\\MSSQLLocalDB")
_DATABASE  = os.getenv("DB_NAME", "SeatNow")
_USER      = os.getenv("DB_USER", "")
_PASSWORD  = os.getenv("DB_PASSWORD", "")
_ENCRYPT   = os.getenv("DB_ENCRYPT", "yes")
_TRUST     = os.getenv("DB_TRUST_CERT", "yes")


def get_connection() -> pyodbc.Connection:
    """Return a new pyodbc connection to MSSQL SeatNow database."""
    if _USER and _PASSWORD:
        conn_str = (
            f"DRIVER={{{_DRIVER}}};"
            f"SERVER={_SERVER};"
            f"DATABASE={_DATABASE};"
            f"UID={_USER};"
            f"PWD={_PASSWORD};"
            f"Encrypt={_ENCRYPT};"
            f"TrustServerCertificate={_TRUST};"
        )
    else:
        # Windows Integrated Authentication (LocalDB)
        conn_str = (
            f"DRIVER={{{_DRIVER}}};"
            f"SERVER={_SERVER};"
            f"DATABASE={_DATABASE};"
            f"Trusted_Connection=yes;"
            f"Encrypt={_ENCRYPT};"
            f"TrustServerCertificate={_TRUST};"
        )
    return pyodbc.connect(conn_str, autocommit=True)
