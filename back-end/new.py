from flask import Flask
from flask_cors import CORS
from routes.tableBluePrint import tables_bp
from routes.ai_assistant import ai_bp
from routes.auth import auth_bp
from routes.ratings import ratings_bp
from routes.bookmarks import bookmarks_bp

# Import route modules so their @tables_bp.route decorators are registered
import routes.getRecipes
import routes.insertInto
import routes.tables

app = Flask(__name__)
CORS(app)
app.register_blueprint(tables_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(ratings_bp)
app.register_blueprint(bookmarks_bp)

if __name__ == "__main__":
    print("Starting app on http://localhost:5000 ...")
    app.run(debug=True, port=5000)