import os
from jinja2 import TemplateNotFound
from flask import Flask, render_template, send_from_directory
from config import Config

# singletons come from extensions.py
from extensions import db, login_manager


def create_app(config_class=Config):
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), "templates")
    )
    app.config.from_object(config_class)

    # sensible defaults for uploads and request size
    if "UPLOAD_FOLDER" not in app.config or not app.config["UPLOAD_FOLDER"]:
        app.config["UPLOAD_FOLDER"] = os.path.join(app.instance_path, "uploads")
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)  # 16 MB

    # initialize extensions
    db.init_app(app)
    login_manager.init_app(app)

    # register blueprints after extensions are initialized (avoids circular imports)
    # adjust url_prefixes here if you want them grouped under /auth, /complaints, /admin
    from routes.auth import auth_bp
    from routes.complaints import complaints_bp
    from routes.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(complaints_bp)
    app.register_blueprint(admin_bp)

    # ensure models are registered with SQLAlchemy metadata then create tables
    # DO NOT run queries or seed data here — use database/init_db.py for seeding
    with app.app_context():
        # import the models module (registers models with SQLAlchemy)
        import models.models  # noqa: F401
        db.create_all()

    # flask-login loader
    @login_manager.user_loader
    def load_user(user_id):
        try:
            from models.models import User
            return User.query.get(int(user_id))
        except Exception:
            return None

    # simple favicon route (prevents browser 404 noise)
    @app.route("/favicon.ico")
    def favicon():
        return send_from_directory(
            os.path.join(app.root_path, "static"),
            "favicon.ico",
            mimetype="image/vnd.microsoft.icon",
        )

    # basic site routes (you can move these into blueprints later)
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/about")
    def about():
        return render_template("about.html")

    @app.route("/features")
    def features():
        return render_template("features.html")

    # error handlers: try to render template, fall back to plain text if missing
    @app.errorhandler(404)
    def not_found_error(error):
        try:
            return render_template("404.html"), 404
        except TemplateNotFound:
            return ("404 Not Found", 404)

    @app.errorhandler(500)
    def internal_error(error):
        # rollback if any transaction left open
        try:
            db.session.rollback()
        except Exception:
            pass

        try:
            return render_template("500.html"), 500
        except TemplateNotFound:
            return ("500 Internal Server Error", 500)

    return app


if __name__ == "__main__":
    app = create_app()
    debug_mode = os.environ.get("FLASK_DEBUG", "1") == "1"
    host = os.environ.get("FLASK_RUN_HOST", "127.0.0.1")
    port = int(os.environ.get("FLASK_RUN_PORT", 5000))
    app.run(debug=debug_mode, host=host, port=port)
