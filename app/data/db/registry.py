# registry.py нужен Alembic'у, чтобы Base.metadata "увидела" таблицы.
# Здесь мы просто импортируем модули моделей (side-effect регистрация в Base.metadata)

from app.data.db.base import Base  # noqa: F401

# Import module models so they are registered in Base.metadata
from app.modules.catalog.data import models as _catalog_models  # noqa: F401
from app.modules.lessons.data import models as _lessons_models  # noqa: F401
from app.modules.problems.data import models as _problems_models  # noqa: F401
from app.modules.projects.data import models as _projects_models  # noqa: F401
from app.modules.submissions.data import models as _submissions_models  # noqa: F401
