import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
import joblib
import os
import json
from datetime import datetime

class ComplaintClassifier:
    """
    AI Classifier for categorizing complaints
    This is a simplified version. In production, you would use more advanced models.
    """
    
    def __init__(self, model_path='models/classifier/classifier.pkl'):
        self.model_path = model_path
        self.model = None
        self.vectorizer = None
        self.categories = [
            'potholes',
            'garbage',
            'streetlight',
            'water',
            'electricity',
            'drainage',
            'traffic',
            'other'
        ]
        
        # Sample training data (in production, load from database)
        self.training_data = {
            'texts': [
                "large pothole on main street causing traffic",
                "garbage accumulation near park smells bad",
                "street light not working on 5th avenue",
                "water leak from main pipe near school",
                "power outage in downtown area since morning",
                "drainage blocked causing water logging",
                "traffic signal malfunction at intersection",
                "noise pollution from construction site",
                "road repair needed after rain damage",
                "illegal dumping in residential area",
                "broken lamp post needs replacement",
                "low water pressure in apartment building",
                "electrical wire hanging dangerously",
                "sewage overflow near hospital",
                "road sign missing on highway",
                "public park maintenance required"
            ],
            'labels': [
                'potholes',
                'garbage',
                'streetlight',
                'water',
                'electricity',
                'drainage',
                'traffic',
                'other',
                'potholes',
                'garbage',
                'streetlight',
                'water',
                'electricity',
                'drainage',
                'traffic',
                'other'
            ]
        }
        
        self.load_or_train_model()
    
    def load_or_train_model(self):
        """Load existing model or train new one"""
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                print(f"Loaded existing model from {self.model_path}")
            except Exception as e:
                print(f"Error loading model: {e}. Training new model...")
                self.train_model()
        else:
            print("No existing model found. Training new model...")
            self.train_model()
    
    def train_model(self):
        """Train the classification model"""
        try:
            # Create pipeline with TF-IDF and Naive Bayes
            self.model = Pipeline([
                ('tfidf', TfidfVectorizer(
                    max_features=1000,
                    stop_words='english',
                    ngram_range=(1, 2)
                )),
                ('clf', MultinomialNB(alpha=0.1))
            ])
            
            # Train the model
            self.model.fit(
                self.training_data['texts'],
                self.training_data['labels']
            )
            
            # Save the model
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(self.model, self.model_path)
            print(f"Model trained and saved to {self.model_path}")
            
            # Save training metadata
            metadata = {
                'trained_at': datetime.now().isoformat(),
                'training_samples': len(self.training_data['texts']),
                'categories': self.categories,
                'accuracy': self.evaluate_model()
            }
            
            with open(self.model_path.replace('.pkl', '_meta.json'), 'w') as f:
                json.dump(metadata, f, indent=2)
                
        except Exception as e:
            print(f"Error training model: {e}")
            self.model = None
    
    def evaluate_model(self):
        """Evaluate model accuracy (simplified)"""
        if not self.model:
            return 0.0
        
        # Simple cross-validation (in production, use proper CV)
        predictions = self.model.predict(self.training_data['texts'])
        accuracy = np.mean(predictions == self.training_data['labels'])
        return round(accuracy, 3)
    
    def predict_category(self, title, description):
        """Predict category for a complaint"""
        if not self.model:
            return self.fallback_classification(title, description)
        
        try:
            # Combine title and description
            text = f"{title} {description}"
            
            # Make prediction
            prediction = self.model.predict([text])[0]
            probability = self.model.predict_proba([text]).max()
            
            return {
                'category': prediction,
                'confidence': round(float(probability), 3),
                'method': 'ai_model'
            }
            
        except Exception as e:
            print(f"Error in AI prediction: {e}")
            return self.fallback_classification(title, description)
    
    def fallback_classification(self, title, description):
        """Fallback to rule-based classification if AI fails"""
        text = f"{title} {description}".lower()
        
        keyword_mapping = {
            'potholes': ['pothole', 'road damage', 'road repair', 'crack', 'bump'],
            'garbage': ['garbage', 'trash', 'waste', 'dump', 'clean', 'sanitation'],
            'streetlight': ['street light', 'lamp post', 'light', 'dark', 'illumination'],
            'water': ['water', 'leak', 'pipe', 'pressure', 'supply', 'quality'],
            'electricity': ['power', 'electric', 'outage', 'wire', 'shock', 'transformer'],
            'drainage': ['drain', 'sewage', 'water logging', 'block', 'overflow'],
            'traffic': ['traffic', 'signal', 'congestion', 'parking', 'road sign']
        }
        
        for category, keywords in keyword_mapping.items():
            for keyword in keywords:
                if keyword in text:
                    return {
                        'category': category,
                        'confidence': 0.7,
                        'method': 'keyword_match'
                    }
        
        return {
            'category': 'other',
            'confidence': 0.5,
            'method': 'default'
        }
    
    def prioritize_complaint(self, category, description, location_data=None):
        """Prioritize complaint based on various factors"""
        
        # Base priority scores
        priority_scores = {
            'Critical': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3
        }
        
        text = description.lower()
        
        # Check for urgent keywords
        urgent_keywords = ['emergency', 'urgent', 'danger', 'accident', 'fire', 'flood', 'collapse']
        for keyword in urgent_keywords:
            if keyword in text:
                return 'Critical'
        
        # Category-based priority
        category_priority = {
            'electricity': 'High',      # Power outages are high priority
            'water': 'High',            # Water issues are high priority
            'drainage': 'High',         # Drainage issues can cause flooding
            'traffic': 'Medium',        # Traffic issues are medium priority
            'potholes': 'Medium',       # Potholes are medium priority
            'streetlight': 'Medium',    # Street lights are medium priority
            'garbage': 'Low',           # Garbage is lower priority
            'other': 'Low'              # Other issues are lower priority
        }
        
        priority = category_priority.get(category, 'Medium')
        
        # Adjust based on description keywords
        high_priority_words = ['broken', 'leak', 'outage', 'blocked', 'hazard', 'safety']
        for word in high_priority_words:
            if word in text and priority != 'Critical':
                priority = 'High'
                break
        
        return priority
    
    def extract_location_info(self, text):
        """Extract location information from text (simplified)"""
        # This would use NLP in production
        location_keywords = ['near', 'at', 'in', 'on', 'beside', 'opposite']
        
        words = text.split()
        for i, word in enumerate(words):
            if word.lower() in location_keywords and i + 1 < len(words):
                location = ' '.join(words[i+1:i+4])
                return location
        
        return None
    
    def get_confidence_intervals(self):
        """Get model confidence statistics"""
        if not self.model:
            return None
        
        try:
            # Get prediction probabilities for training data
            probas = self.model.predict_proba(self.training_data['texts'])
            avg_confidence = probas.max(axis=1).mean()
            
            return {
                'average_confidence': round(float(avg_confidence), 3),
                'min_confidence': round(float(probas.max(axis=1).min()), 3),
                'max_confidence': round(float(probas.max(axis=1).max()), 3),
                'training_samples': len(self.training_data['texts'])
            }
        except Exception as e:
            print(f"Error getting confidence intervals: {e}")
            return None
    
    def retrain_with_feedback(self, text, actual_category):
        """Retrain model with new labeled data"""
        try:
            # Add new training example
            self.training_data['texts'].append(text)
            self.training_data['labels'].append(actual_category)
            
            # Retrain model
            self.train_model()
            
            print(f"Model retrained with new example: {text[:50]}... -> {actual_category}")
            return True
            
        except Exception as e:
            print(f"Error retraining model: {e}")
            return False

# Singleton instance
classifier = ComplaintClassifier()

# Example usage
if __name__ == "__main__":
    # Test the classifier
    test_cases = [
        ("Power outage in sector 5", "No electricity since morning, affecting 50 houses"),
        ("Garbage pile near market", "Uncleared garbage for 3 days, causing smell"),
        ("Pothole on highway", "Large pothole causing traffic jam and accidents"),
        ("Water leak complaint", "Pipe burst near school, water wastage")
    ]
    
    for title, description in test_cases:
        result = classifier.predict_category(title, description)
        priority = classifier.prioritize_complaint(result['category'], description)
        
        print(f"Title: {title}")
        print(f"Description: {description}")
        print(f"Predicted: {result['category']} (Confidence: {result['confidence']}, Method: {result['method']})")
        print(f"Priority: {priority}")
        print("-" * 50)