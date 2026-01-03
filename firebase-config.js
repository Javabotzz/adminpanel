// Firebase Configuration - USING COMPAT VERSION
const firebaseConfig = {
  apiKey: "AIzaSyDd858DNFPb2wtIAon5fO6ahQAS23jO82I",
  authDomain: "revan-s-mobile-wellness.firebaseapp.com",
  databaseURL: "https://kiki-s-mobile-wellness-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vannn-s-mobile-wellness",
  storageBucket: "revan-s-mobile-wellness.firebasestorage.app",
  messagingSenderId: "729286447527",
  appId: "1:729286447527:web:15d8d3a047a588e5e12682"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();