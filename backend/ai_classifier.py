"""
FinAgent AI — Clasificador dinámico de categorías.

DINÁMICO:
- Lee las categorías actuales de la BD al arrancar
- Genera datos de entrenamiento con palabras clave por categoría
- Se re-entrena al crear categorías o transacciones nuevas
- Categorías nuevas del usuario se incorporan automáticamente
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
import re


# ── Palabras clave semilla para categorías comunes ─────────────
# Para categorías que no estén aquí, el modelo aprende
# de las transacciones del usuario + el nombre de la categoría.
BASE_KEYWORDS = {
    "supermercado": [
        "mercado éxito",
        "supermercado",
        "jumbo",
        "d1",
        "ara",
        "olimpica",
        "carulla",
        "makro",
        "frutas verduras",
        "víveres",
        "tienda",
        "leche pan huevos",
        "mercado semanal",
        "mercado mensual",
        "compras hogar",
        "abarrotes",
        "despensa",
    ],
    "restaurante": [
        "almuerzo",
        "cena",
        "desayuno",
        "restaurante",
        "comida rápida",
        "hamburguesa",
        "pizza",
        "rappi",
        "ifood",
        "domicilio comida",
        "sushi",
        "corrientazo",
        "comida",
        "mcdonald",
        "subway",
        "pollo",
        "café",
        "cafetería",
        "brunch",
        "helado",
    ],
    "transporte": [
        "uber",
        "didi",
        "taxi",
        "gasolina",
        "tanqueo",
        "peaje",
        "bus",
        "transmilenio",
        "mio",
        "parqueadero",
        "estacionamiento",
        "pasaje",
        "indriver",
        "beat",
        "lavada carro",
        "mantenimiento carro",
        "soat",
        "taller mecánico",
    ],
    "salud": [
        "médico",
        "doctor",
        "cita médica",
        "farmacia",
        "droguería",
        "medicina",
        "pastillas",
        "hospital",
        "clínica",
        "eps",
        "consulta",
        "exámenes",
        "odontólogo",
        "dentista",
        "oftalmólogo",
        "laboratorio",
        "vacuna",
        "terapia",
    ],
    "entretenimiento": [
        "cine",
        "netflix",
        "spotify",
        "concierto",
        "fiesta",
        "bar",
        "discoteca",
        "rumba",
        "película",
        "teatro",
        "parque diversiones",
        "bowling",
        "videojuego",
        "steam",
        "playstation",
        "xbox",
    ],
    "ropa": [
        "ropa",
        "zapatos",
        "camisa",
        "pantalón",
        "vestido",
        "chaqueta",
        "zara",
        "tennis",
        "tenis",
        "camiseta",
        "jean",
        "falda",
        "accesorios",
    ],
    "tecnología": [
        "celular",
        "computador",
        "laptop",
        "audífonos",
        "cable usb",
        "mouse",
        "teclado",
        "monitor",
        "tablet",
        "iphone",
        "samsung",
        "cargador",
        "software",
        "app store",
    ],
    "hogar": [
        "mueble",
        "decoración",
        "silla",
        "mesa",
        "cama",
        "almohada",
        "cortina",
        "lámpara",
        "toalla",
        "aseo hogar",
        "detergente",
        "jabón",
        "escoba",
        "limpieza",
    ],
    "educación": [
        "universidad",
        "curso",
        "libro",
        "matrícula",
        "udemy",
        "coursera",
        "seminario",
        "taller",
        "colegio",
        "útiles",
        "cuaderno",
        "clase",
        "platzi",
        "diplomado",
    ],
    "servicios": [
        "electricidad",
        "agua",
        "gas",
        "internet",
        "teléfono",
        "celular plan",
        "emcali",
        "epm",
        "factura luz",
        "factura agua",
        "recibo",
        "servicio público",
    ],
    "arriendo": [
        "arriendo",
        "renta",
        "alquiler",
        "canon arriendo",
        "administración",
        "cuota administración",
    ],
    "suscripciones": [
        "suscripción",
        "membresía",
        "amazon prime",
        "disney plus",
        "hbo",
        "youtube premium",
        "gimnasio",
        "gym",
        "plan mensual",
    ],
    "salario": [
        "salario",
        "nómina",
        "sueldo",
        "pago mensual",
        "quincena",
        "pago empresa",
        "ingreso laboral",
    ],
    "freelance": [
        "freelance",
        "proyecto independiente",
        "consultoría",
        "trabajo extra",
        "cliente",
        "honorarios",
        "ingreso extra",
    ],
    "otro": ["otro", "varios", "misceláneo", "gasto general"],
}


def _clean(text: str) -> str:
    """Normaliza texto: minúsculas, sin caracteres especiales."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\sáéíóúñü]", "", text)
    return text


class CategoryClassifier:
    """Clasificador dinámico: aprende de la BD y de las transacciones."""

    def __init__(self):
        self.pipeline = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        analyzer="char_wb", ngram_range=(2, 4), max_features=5000
                    ),
                ),
                ("clf", MultinomialNB(alpha=0.1)),
            ]
        )
        self.is_trained = False
        self.categories = []

    def _build_training_data(self, db_categories: list, user_transactions: list = None):
        """
        Construye datos de entrenamiento combinando:
        1. Palabras clave base (si la categoría tiene match)
        2. El propio nombre de la categoría como ejemplo
        3. Transacciones reales del usuario
        """
        texts = []
        labels = []

        for cat_name in db_categories:
            cat_lower = cat_name.lower().strip()

            # 1. Buscar palabras clave base que coincidan con esta categoría
            matched_keywords = BASE_KEYWORDS.get(cat_lower, [])
            for keyword in matched_keywords:
                texts.append(_clean(keyword))
                labels.append(cat_name)

            # 2. Siempre agregar el nombre de la categoría como ejemplo
            #    (así categorías nuevas sin keywords tienen al menos 1 ejemplo)
            texts.append(_clean(cat_name))
            labels.append(cat_name)

            # 3. Agregar variantes del nombre para categorías sin keywords
            if not matched_keywords:
                # Agregar el nombre repetido con variantes para dar más peso
                texts.append(_clean(f"pago {cat_name}"))
                labels.append(cat_name)
                texts.append(_clean(f"gasto {cat_name}"))
                labels.append(cat_name)
                texts.append(_clean(f"compra {cat_name}"))
                labels.append(cat_name)

        # 4. Agregar transacciones reales del usuario
        if user_transactions:
            for desc, cat in user_transactions:
                if desc and cat and cat in db_categories:
                    texts.append(_clean(desc))
                    labels.append(cat)

        return texts, labels

    def train(self, db_categories: list, user_transactions: list = None):
        """
        Entrena/re-entrena el modelo con las categorías actuales de la BD.
        db_categories: lista de nombres de categorías (strings)
        user_transactions: lista de tuplas (description, category)
        """
        if len(db_categories) < 2:
            self.is_trained = False
            return

        texts, labels = self._build_training_data(db_categories, user_transactions)

        # Verificar que hay al menos 2 clases distintas
        unique_labels = set(labels)
        if len(unique_labels) < 2:
            self.is_trained = False
            return

        self.pipeline.fit(texts, labels)
        self.categories = list(unique_labels)
        self.is_trained = True

    def predict(self, description: str) -> dict:
        """
        Predice la categoría para una descripción.
        Retorna: { category, confidence, all_predictions }
        """
        if not self.is_trained:
            return {"category": "Otro", "confidence": 0.0, "all_predictions": []}

        clean = _clean(description)
        if not clean or len(clean) < 2:
            return {"category": "Otro", "confidence": 0.0, "all_predictions": []}

        predicted = self.pipeline.predict([clean])[0]
        probas = self.pipeline.predict_proba([clean])[0]
        classes = self.pipeline.classes_

        # Top 3 predicciones
        top_indices = probas.argsort()[-3:][::-1]
        all_predictions = [
            {"category": classes[i], "confidence": round(float(probas[i]) * 100, 1)}
            for i in top_indices
        ]

        confidence = round(float(max(probas)) * 100, 1)

        return {
            "category": predicted,
            "confidence": confidence,
            "all_predictions": all_predictions,
        }


# Instancia global del clasificador
classifier = CategoryClassifier()
