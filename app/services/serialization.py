from sqlalchemy.inspection import inspect


def model_to_dict(model) -> dict:
    return {column.key: getattr(model, column.key) for column in inspect(model).mapper.column_attrs}


def models_to_dicts(models) -> list[dict]:
    return [model_to_dict(model) for model in models]
