# registry.py нужен Alembic'у, чтобы Base.metadata "увидела" таблицы.
# Здесь мы просто импортируем модули моделей (side-effect регистрация в Base.metadata)

from app.data.db.base import Base  # noqa: F401

# Import module models so they are registered in Base.metadata
from app.modules.projects.data import models as _projects_models  # noqa: F401
from app.data.db.base import Base  # noqa: F401
from app.modules.users.data import models as _users_models  # noqa: F401
from app.modules.auth.data import models as _auth_models  # noqa: F401

