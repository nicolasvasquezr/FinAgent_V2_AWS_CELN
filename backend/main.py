from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from database import SessionLocal, engine, Base
from models import Transaction, Category
from schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionOut,
    CategoryCreate,
    CategoryUpdate,
    CategoryOut,
)
from ai_classifier import classifier

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinAgent AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_CATEGORIES = [
    {"name": "Supermercado", "icon": "🛒", "color": "#10b981"},
    {"name": "Restaurante", "icon": "🍽️", "color": "#f59e0b"},
    {"name": "Transporte", "icon": "🚗", "color": "#3b82f6"},
    {"name": "Salud", "icon": "🏥", "color": "#ef4444"},
    {"name": "Entretenimiento", "icon": "🎬", "color": "#8b5cf6"},
    {"name": "Ropa", "icon": "👕", "color": "#ec4899"},
    {"name": "Tecnología", "icon": "💻", "color": "#06b6d4"},
    {"name": "Hogar", "icon": "🏠", "color": "#84cc16"},
    {"name": "Educación", "icon": "📚", "color": "#f97316"},
    {"name": "Servicios", "icon": "💡", "color": "#64748b"},
    {"name": "Arriendo", "icon": "🏢", "color": "#a78bfa"},
    {"name": "Suscripciones", "icon": "📱", "color": "#0ea5e9"},
    {"name": "Salario", "icon": "💵", "color": "#22c55e"},
    {"name": "Freelance", "icon": "🧑‍💻", "color": "#16a34a"},
    {"name": "Otro", "icon": "💰", "color": "#94a3b8"},
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _train_ai_from_db(db: Session):
    """Lee categorías y transacciones de la BD y entrena la IA."""
    cat_names = [c.name for c in db.query(Category).all()]
    txs = db.query(Transaction).all()
    user_data = [
        (t.description, t.category) for t in txs if t.description and t.category
    ]
    classifier.train(cat_names, user_data)


@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        # Seed categorías por defecto
        if db.query(Category).count() == 0:
            for cat in DEFAULT_CATEGORIES:
                db.add(Category(**cat))
            db.commit()
        # Entrenar IA con las categorías y transacciones existentes
        _train_ai_from_db(db)
    finally:
        db.close()


# ── CATEGORIES ────────────────────────────────────────────────
@app.get("/api/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name).all()


@app.post("/api/categories", response_model=CategoryOut, status_code=201)
def create_category(cat: CategoryCreate, db: Session = Depends(get_db)):
    if db.query(Category).filter(Category.name == cat.name).first():
        raise HTTPException(status_code=409, detail="La categoría ya existe")
    obj = Category(**cat.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # Re-entrenar IA con la nueva categoría
    _train_ai_from_db(db)
    return obj


@app.put("/api/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, cat: CategoryUpdate, db: Session = Depends(get_db)):
    obj = db.query(Category).filter(Category.id == cat_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for k, v in cat.dict(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    # Re-entrenar IA por si cambió el nombre
    _train_ai_from_db(db)
    return obj


@app.delete("/api/categories/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    obj = db.query(Category).filter(Category.id == cat_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    db.delete(obj)
    db.commit()
    # Re-entrenar IA sin la categoría eliminada
    _train_ai_from_db(db)
    return {"ok": True}


# ── TRANSACTIONS ──────────────────────────────────────────────
@app.get("/api/transactions", response_model=list[TransactionOut])
def list_transactions(
    month: str = None,
    category: str = None,
    type: str = None,
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if month:
        q = q.filter(Transaction.date.like(f"{month}%"))
    if category:
        q = q.filter(Transaction.category == category)
    if type:
        q = q.filter(Transaction.type == type)
    return q.order_by(Transaction.date.desc()).all()


@app.post("/api/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    obj = Transaction(**tx.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # Re-entrenar IA con la nueva transacción (aprende del usuario)
    _train_ai_from_db(db)
    return obj


@app.put("/api/transactions/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int, tx: TransactionUpdate, db: Session = Depends(get_db)
):
    obj = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    for k, v in tx.dict(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    obj = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── STATS ─────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(month: str = None, db: Session = Depends(get_db)):
    if not month:
        month = datetime.now().strftime("%Y-%m")

    month_txs = db.query(Transaction).filter(Transaction.date.like(f"{month}%")).all()

    gastos = sum(t.total for t in month_txs if t.type == "gasto")
    ingresos = sum(t.total for t in month_txs if t.type == "ingreso")

    by_category: dict = {}
    for t in month_txs:
        if t.type == "gasto":
            by_category[t.category] = by_category.get(t.category, 0) + t.total

    monthly: dict = {}
    for t in db.query(Transaction).all():
        ym = t.date[:7] if t.date else "unknown"
        if ym not in monthly:
            monthly[ym] = {"gastos": 0, "ingresos": 0}
        if t.type == "ingreso":
            monthly[ym]["ingresos"] += t.total
        else:
            monthly[ym]["gastos"] += t.total

    return {
        "month": month,
        "gastos": gastos,
        "ingresos": ingresos,
        "balance": ingresos - gastos,
        "count": len(month_txs),
        "by_category": by_category,
        "monthly": monthly,
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "FinAgent AI API v2"}


# ── AI CLASSIFIER ────────────────────────────────────────────
class ClassifyRequest(BaseModel):
    description: str


@app.post("/api/ai/classify")
def classify_transaction(req: ClassifyRequest):
    """Usa IA (NLP) para predecir la categoría basándose en la descripción."""
    result = classifier.predict(req.description)
    return result


@app.post("/api/ai/retrain")
def retrain_model(db: Session = Depends(get_db)):
    """Re-entrena el modelo de IA manualmente."""
    _train_ai_from_db(db)
    return {
        "ok": True,
        "categories": classifier.categories,
        "message": "Modelo re-entrenado con categorías y transacciones actuales",
    }


@app.get("/api/ai/info")
def ai_info():
    """Información sobre el modelo de IA."""
    return {
        "model": "TF-IDF + Multinomial Naive Bayes",
        "library": "scikit-learn",
        "type": "Clasificador de texto (NLP)",
        "description": "Clasifica automáticamente transacciones financieras en categorías usando procesamiento de lenguaje natural. Se re-entrena dinámicamente al crear categorías o transacciones.",
        "trained": classifier.is_trained,
        "categories": classifier.categories,
        "features": [
            "Clasificación automática por descripción",
            "Aprendizaje dinámico de nuevas categorías",
            "Re-entrenamiento automático con cada transacción",
            "Predicción con nivel de confianza",
            "Top 3 categorías sugeridas",
        ],
    }
