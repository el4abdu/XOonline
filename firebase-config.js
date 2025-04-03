// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqDw3gBxPQWwdqjySIFmlza8cvjg2V9zw",
  authDomain: "xogame-94c8b.firebaseapp.com",
  databaseURL: "https://xogame-94c8b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "xogame-94c8b",
  storageBucket: "xogame-94c8b.firebasestorage.app",
  messagingSenderId: "806770328963",
  appId: "1:806770328963:web:7f132c2d939907d60d22b6"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  alert('Error connecting to Firebase. Check console for details.');
}

// Get a reference to the database service
const database = firebase.database();

// Test Database Connection
database.ref('.info/connected').on('value', (snapshot) => {
  const connected = snapshot.val();
  console.log('Firebase Database connection:', connected ? 'Connected' : 'Disconnected');
});

// Export for use in other files
window.database = database;

// Set persistence to improve offline capability
firebase.database().setPersistence('session')
  .then(() => {
    console.log('Firebase persistence set to session');
  })
  .catch((error) => {
    console.error('Firebase persistence error:', error);
  }); 