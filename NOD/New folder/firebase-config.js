/**
 * ========================================
 * FIREBASE CONFIGURATION (Firestore + Auth)
 * NOD - Game Based Learning System
 * ========================================
 */

// Firebase configuration - Using NOD Capstone Project
const firebaseConfig = {
    apiKey: "AIzaSyCwvrwRoPNXptku6oSjqX8qV-38mWqBCqA",
    authDomain: "capstone-project-nod-16ff9.firebaseapp.com",
    projectId: "capstone-project-nod-16ff9",
    storageBucket: "capstone-project-nod-16ff9.firebasestorage.app",
    messagingSenderId: "244508008998",
    appId: "1:244508008998:web:56abc30f10c23f5005bce7"
};

// Demo mode flag - set to true to test without Firebase
let DEMO_MODE = false;

// Firebase references
let db = null;
let auth = null;
let gamesCollection = null;
let leaderboardCollection = null;
let usersCollection = null;
let quizzesCollection = null;
let quizSessionsCollection = null;
let classroomsCollection = null;
let classroomMembersCollection = null;

// Current logged-in user data
let currentUser = null;
let currentUserData = null;

function initializeFirebase() {
    // Prevent double initialization
    if (db && auth) {
        console.log("Firebase already initialized");
        return true;
    }
    
    try {
        // Check if config has been set up
        if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
            console.log("⚠️ Firebase not configured. Running in DEMO MODE.");
            DEMO_MODE = true;
            updateFirebaseStatus(false, "Demo Mode (Firebase not configured)");
            return false;
        }

        // Initialize Firebase (check if already initialized)
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // Initialize Firestore
        db = firebase.firestore();
        auth = firebase.auth();
        gamesCollection = db.collection('games');
        leaderboardCollection = db.collection('leaderboard');
        usersCollection = db.collection('users');
        quizzesCollection = db.collection('quizzes');
        quizSessionsCollection = db.collection('quizSessions');
        classroomsCollection = db.collection('classrooms');
        classroomMembersCollection = db.collection('classroomMembers');
        
        console.log("✅ Connected to Firebase!");
        DEMO_MODE = false;
        updateFirebaseStatus(true, "Connected to Firebase");
        
        return true;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        DEMO_MODE = true;
        updateFirebaseStatus(false, "Error: " + error.message);
        return false;
    }
}

function updateFirebaseStatus(connected, message) {
    const indicator = document.getElementById('firebase-indicator');
    const statusText = document.getElementById('firebase-status-text');
    
    if (indicator) {
        indicator.classList.remove('online', 'offline');
        indicator.classList.add(connected ? 'online' : 'offline');
    }
    
    if (statusText) {
        statusText.textContent = message;
    }
}

// ========================================
// FIRESTORE DATABASE FUNCTIONS
// ========================================

// Create a new game session
async function createGameSession(player1Name, player2Name, player1Cards, player2Cards) {
    if (DEMO_MODE) {
        return {
            id: 'demo-game-' + Date.now(),
            demo: true
        };
    }
    
    const gameData = {
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active',
        currentTurn: 1,
        round: 1,
        players: {
            player1: {
                name: player1Name,
                cards: player1Cards,
                playedCard: null,
                score: player1Cards.reduce((a, b) => a + b, 0),
                lastPlayedCard: null
            },
            player2: {
                name: player2Name,
                cards: player2Cards,
                playedCard: null,
                score: player2Cards.reduce((a, b) => a + b, 0),
                lastPlayedCard: null
            }
        },
        timer: {
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            duration: player1Cards.length * 2 * 60 * 1000 // cards * 2 minutes in ms
        }
    };
    
    const docRef = await gamesCollection.add(gameData);
    return {
        id: docRef.id,
        demo: false
    };
}

// Update player's played card
async function playCard(gameId, playerNum, cardValue) {
    if (DEMO_MODE) return true;
    
    await gamesCollection.doc(gameId).update({
        [`players.player${playerNum}.playedCard`]: cardValue
    });
    return true;
}

// Listen to game changes in real-time
function listenToGame(gameId, callback) {
    if (DEMO_MODE) return () => {};
    
    // Returns unsubscribe function
    return gamesCollection.doc(gameId).onSnapshot((doc) => {
        if (doc.exists) {
            callback({ id: doc.id, ...doc.data() });
        }
    });
}

// Update leaderboard (game history only - user stats are updated separately in endGame)
async function updateLeaderboard(player1Name, player1Score, player2Name, player2Score, gameId, winnerName) {
    if (DEMO_MODE) {
        console.log("Demo Mode: Leaderboard updated locally");
        return;
    }
    
    const leaderboardEntry = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        gameId: gameId,
        players: [
            { name: player1Name, score: player1Score },
            { name: player2Name, score: player2Score }
        ],
        winner: winnerName  // Use actual game winner (accounts for resignations)
    };
    
    await leaderboardCollection.add(leaderboardEntry);
    // NOTE: User stats are updated in endGame() - do NOT update here to avoid double counting
}

// Get user by UID (for logged-in user)
async function getUserByUid(uid) {
    console.log('getUserByUid called with uid:', uid);
    console.log('DEMO_MODE:', DEMO_MODE);
    console.log('usersCollection:', usersCollection);
    
    if (DEMO_MODE) {
        return { displayName: 'Demo User', totalScore: 0, gamesPlayed: 0, wins: 0, losses: 0 };
    }
    
    if (!usersCollection) {
        console.error('usersCollection is not initialized!');
        return null;
    }
    
    try {
        console.log('Fetching document...');
        const userDoc = await usersCollection.doc(uid).get();
        console.log('Document exists:', userDoc.exists);
        
        if (userDoc.exists) {
            const data = { id: userDoc.id, ...userDoc.data() };
            if (data.isDeleted === true || data.status === 'deleted') {
                console.log('User is marked deleted:', uid);
                return null;
            }
            console.log('User data:', data);
            return data;
        }

        // Fallback for manually created docs that may not use UID as document ID.
        const byUidSnapshot = await usersCollection
            .where('uid', '==', uid)
            .limit(1)
            .get();

        if (!byUidSnapshot.empty) {
            const fallbackDoc = byUidSnapshot.docs[0];
            const data = { id: fallbackDoc.id, ...fallbackDoc.data() };
            if (data.isDeleted === true || data.status === 'deleted') {
                console.log('User is marked deleted via uid lookup:', uid);
                return null;
            }
            console.log('User data found via uid field:', data);
            return data;
        }

        console.log('No document found for uid:', uid);
        return null;
    } catch (error) {
        console.error('Error getting user by UID:', error);
        return null;
    }
}

// Find user by displayName (for Player 2 verification)
async function findUserByDisplayName(displayName) {
    if (DEMO_MODE) {
        return { displayName: displayName, totalScore: 0, gamesPlayed: 0, wins: 0, losses: 0, uid: 'demo-user' };
    }
    
    const snapshot = await usersCollection
        .where('displayName', '==', displayName)
        .limit(1)
        .get();
    
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = { id: doc.id, ...doc.data() };
        if (data.isDeleted === true || data.status === 'deleted') {
            return null;
        }
        return data;
    }
    return null;
}

// Check if displayName is already taken
async function isDisplayNameTaken(displayName) {
    if (DEMO_MODE) return false;
    
    const snapshot = await usersCollection
        .where('displayName', '==', displayName)
        .limit(1)
        .get();
    
    return !snapshot.empty;
}

// Legacy function for compatibility - now uses uid
async function getOrCreateUser(username) {
    if (DEMO_MODE) {
        return { name: username, totalScore: 0, gamesPlayed: 0, wins: 0, losses: 0 };
    }
    
    // Try to find by displayName first
    const user = await findUserByDisplayName(username);
    if (user) {
        return user;
    }
    
    // Return demo data if not found (game will use actual auth users)
    return { name: username, displayName: username, totalScore: 0, gamesPlayed: 0, wins: 0, losses: 0 };
}

// Update user stats after a game (by UID)
async function updateUserStatsByUid(uid, gameScore, won, resigned = false) {
    if (DEMO_MODE) return;
    
    const userRef = usersCollection.doc(uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
        const updateData = {
            totalScore: firebase.firestore.FieldValue.increment(gameScore),
            gamesPlayed: firebase.firestore.FieldValue.increment(1),
            wins: firebase.firestore.FieldValue.increment(won ? 1 : 0),
            losses: firebase.firestore.FieldValue.increment(won ? 0 : 1),
            lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (resigned) {
            updateData.resignations = firebase.firestore.FieldValue.increment(1);
        }
        await userRef.update(updateData);
    }
}

// Legacy function - redirects to UID-based update
async function updateUserStats(username, gameScore, won, resigned = false) {
    if (DEMO_MODE) return;
    
    // Find user by displayName and update by UID
    const user = await findUserByDisplayName(username);
    if (user && user.id) {
        await updateUserStatsByUid(user.id, gameScore, won, resigned);
    }
}

// Get all-time leaderboard from users
async function getAllTimeLeaderboard(limit = 10) {
    if (DEMO_MODE) return [];
    
    const snapshot = await usersCollection
        .orderBy('totalScore', 'desc')
        .limit(limit)
        .get();
    
    const entries = [];
    snapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() });
    });
    return entries;
}

// Get leaderboard history
async function getLeaderboardHistory(limit = 10) {
    if (DEMO_MODE) return [];
    
    const snapshot = await leaderboardCollection
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    
    const entries = [];
    snapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() });
    });
    return entries;
}

// Update game state
async function updateGameState(gameId, updates) {
    if (DEMO_MODE) return;
    
    // Convert nested path notation to Firestore dot notation
    const firestoreUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
        firestoreUpdates[key.replace(/\//g, '.')] = value;
    }
    
    await gamesCollection.doc(gameId).update(firestoreUpdates);
}

// ========================================
// QUIZ FUNCTIONS
// ========================================

// Generate a unique 6-character quiz code
function generateQuizCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create a new quiz
async function createQuiz(teacherUid, teacherName, quizData) {
    if (DEMO_MODE) {
        return { id: 'demo-quiz-' + Date.now(), code: 'DEMO01', demo: true };
    }

    const isClassroomQuiz = !!quizData.classroomId;
    let quizCode = null;

    if (!isClassroomQuiz) {
        // Legacy flow support: generate unique code only for non-classroom quizzes
        quizCode = generateQuizCode();

        let attempts = 0;
        while (attempts < 10) {
            const existing = await quizzesCollection.where('code', '==', quizCode).limit(1).get();
            if (existing.empty) break;
            quizCode = generateQuizCode();
            attempts++;
        }
    }
    
    const quiz = {
        code: quizCode,
        title: quizData.title,
        description: quizData.description || '',
        teacherUid: teacherUid,
        teacherName: teacherName,
        classroomId: quizData.classroomId || null,
        classroomName: quizData.classroomName || null,
        classroomCode: quizData.classroomCode || null,
        accessMode: isClassroomQuiz ? 'classroom' : 'code',
        rounds: quizData.rounds, // Array of rounds, each with 5 questions
        totalRounds: quizData.rounds.length,
        questionsPerRound: 5,
        status: 'active', // active, closed
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await quizzesCollection.add(quiz);
    
    // Update teacher's quizzesCreated array (using set with merge to avoid error if field doesn't exist)
    try {
        await usersCollection.doc(teacherUid).set({
            quizzesCreated: firebase.firestore.FieldValue.arrayUnion(docRef.id)
        }, { merge: true });
    } catch (e) {
        console.warn('Could not update teacher quizzesCreated array:', e);
    }
    
    return { id: docRef.id, code: quizCode, demo: false };
}

// Get quiz by code
async function getQuizByCode(code) {
    if (DEMO_MODE) return null;
    
    const snapshot = await quizzesCollection
        .where('code', '==', code.toUpperCase())
        .where('status', '==', 'active')
        .where('accessMode', '==', 'code')
        .limit(1)
        .get();
    
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

// Get quiz by ID
async function getQuizById(quizId) {
    if (DEMO_MODE) return null;
    
    const doc = await quizzesCollection.doc(quizId).get();
    if (doc.exists) {
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

// Get all quizzes by teacher
async function getQuizzesByTeacher(teacherUid, classroomId = null) {
    if (DEMO_MODE) return [];
    
    try {
        let query = quizzesCollection
            .where('teacherUid', '==', teacherUid)
            .where('status', '==', 'active');

        if (classroomId) {
            query = query.where('classroomId', '==', classroomId);
        }

        const snapshot = await query.get();
        
        const quizzes = [];
        snapshot.forEach(doc => {
            quizzes.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt client-side (avoids needing composite index)
        quizzes.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
        
        return quizzes;
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        return [];
    }
}

// Create a quiz session (when 2 players join)
async function createQuizSession(quizId, player1Uid, player1Name, player2Uid, player2Name) {
    if (DEMO_MODE) {
        return { id: 'demo-session-' + Date.now(), demo: true };
    }
    
    const quiz = await getQuizById(quizId);

    if (quiz?.classroomId) {
        const p1Enrolled = await isUserEnrolledInClassroom(quiz.classroomId, player1Uid);
        const p2Enrolled = await isUserEnrolledInClassroom(quiz.classroomId, player2Uid);
        if (!p1Enrolled || !p2Enrolled) {
            throw new Error('Both players must be enrolled in the classroom to start this quiz.');
        }
    }

    const session = {
        quizId: quizId,
        quizTitle: quiz?.title || 'Quiz',
        classroomId: quiz?.classroomId || null,
        classroomName: quiz?.classroomName || null,
        status: 'waiting', // waiting, player1_quiz, player2_quiz, ready_for_game, game_in_progress, completed
        players: {
            player1: {
                uid: player1Uid,
                name: player1Name,
                quizCompleted: false,
                cards: [], // Cards earned from quiz (1 per round)
                answers: [], // Array of {roundIndex, questionIndex, answer, correct, correctAnswer}
                score: 0
            },
            player2: {
                uid: player2Uid,
                name: player2Name,
                quizCompleted: false,
                cards: [],
                answers: [],
                score: 0
            }
        },
        currentPlayer: 1,
        gameId: null, // Link to game once started
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await quizSessionsCollection.add(session);
    return { id: docRef.id, demo: false };
}

// Update quiz session player results
async function updateQuizSessionPlayer(sessionId, playerNum, answers, cards, score) {
    if (DEMO_MODE) return;
    
    const updateData = {
        [`players.player${playerNum}.answers`]: answers,
        [`players.player${playerNum}.cards`]: cards,
        [`players.player${playerNum}.score`]: score,
        [`players.player${playerNum}.quizCompleted`]: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await quizSessionsCollection.doc(sessionId).update(updateData);
}

// Update hint usage count for a player in a quiz session
async function updateQuizSessionHintUsage(sessionId, playerNum, hintsUsed) {
    if (DEMO_MODE) return;
    
    const updateData = {
        [`players.player${playerNum}.hintsUsed`]: hintsUsed,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await quizSessionsCollection.doc(sessionId).update(updateData);
}

// Get quiz session by ID
async function getQuizSession(sessionId) {
    if (DEMO_MODE) return null;
    
    const doc = await quizSessionsCollection.doc(sessionId).get();
    if (doc.exists) {
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

// Update quiz session status
async function updateQuizSessionStatus(sessionId, status, additionalData = {}) {
    if (DEMO_MODE) return;
    
    const updateData = {
        status: status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...additionalData
    };
    
    await quizSessionsCollection.doc(sessionId).update(updateData);
}

// Get user's quiz history (for review)
async function getUserQuizHistory(uid) {
    if (DEMO_MODE) return [];
    
    try {
        // Get sessions where user was player1 or player2
        const p1Sessions = await quizSessionsCollection
            .where('players.player1.uid', '==', uid)
            .get();
        
        const p2Sessions = await quizSessionsCollection
            .where('players.player2.uid', '==', uid)
            .get();
        
        const sessions = [];
        p1Sessions.forEach(doc => sessions.push({ id: doc.id, playerNum: 1, ...doc.data() }));
        p2Sessions.forEach(doc => sessions.push({ id: doc.id, playerNum: 2, ...doc.data() }));
        
        // Sort by createdAt desc (client-side to avoid index requirement)
        sessions.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
        
        return sessions.slice(0, 20);
    } catch (error) {
        console.error('Error getting quiz history:', error);
        return [];
    }
}

// ========================================
// CLASSROOM FUNCTIONS
// ========================================

function generateClassroomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function classroomMemberDocId(uid, classroomId) {
    return `${uid}_${classroomId}`;
}

async function createClassroom(teacherUid, teacherName, classroomData) {
    if (DEMO_MODE) {
        return { id: 'demo-class-' + Date.now(), code: 'CLASS001', demo: true };
    }

    let classroomCode = generateClassroomCode();
    let attempts = 0;
    while (attempts < 10) {
        const existing = await classroomsCollection.where('code', '==', classroomCode).limit(1).get();
        if (existing.empty) break;
        classroomCode = generateClassroomCode();
        attempts++;
    }

    const classroom = {
        name: classroomData.name,
        description: classroomData.description || '',
        subject: classroomData.subject || '',
        profilePicture: classroomData.profilePicture || null,
        teacherUid,
        teacherName,
        code: classroomCode,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await classroomsCollection.add(classroom);

    await classroomMembersCollection.doc(classroomMemberDocId(teacherUid, docRef.id)).set({
        classroomId: docRef.id,
        uid: teacherUid,
        displayName: teacherName,
        role: 'teacher',
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: teacherUid
    });

    return { id: docRef.id, code: classroomCode, demo: false };
}

async function updateClassroom(classroomId, updates) {
    if (DEMO_MODE) return;
    await classroomsCollection.doc(classroomId).update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function deleteClassroom(classroomId) {
    if (DEMO_MODE) return;

    const quizSnapshot = await quizzesCollection.where('classroomId', '==', classroomId).get();
    for (const quizDoc of quizSnapshot.docs) {
        await deleteQuiz(quizDoc.id);
    }

    const memberSnapshot = await classroomMembersCollection.where('classroomId', '==', classroomId).get();
    for (const memberDoc of memberSnapshot.docs) {
        await memberDoc.ref.delete();
    }

    await classroomsCollection.doc(classroomId).delete();
}

async function getClassroomById(classroomId) {
    if (DEMO_MODE) return null;

    const doc = await classroomsCollection.doc(classroomId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

async function getClassroomByCode(classCode) {
    if (DEMO_MODE) return null;

    const snapshot = await classroomsCollection
        .where('code', '==', classCode.toUpperCase())
        .where('status', '==', 'active')
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

async function getTeacherClassrooms(teacherUid) {
    if (DEMO_MODE) return [];

    const snapshot = await classroomsCollection
        .where('teacherUid', '==', teacherUid)
        .where('status', '==', 'active')
        .get();

    const classrooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    classrooms.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return classrooms;
}

async function getStudentClassrooms(studentUid) {
    if (DEMO_MODE) return [];

    const membershipSnapshot = await classroomMembersCollection
        .where('uid', '==', studentUid)
        .where('role', '==', 'student')
        .get();

    const classroomIds = membershipSnapshot.docs.map(doc => doc.data().classroomId);
    if (classroomIds.length === 0) return [];

    const classrooms = [];
    for (const classroomId of classroomIds) {
        const classroom = await getClassroomById(classroomId);
        if (classroom && classroom.status === 'active') classrooms.push(classroom);
    }

    classrooms.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return classrooms;
}

async function isUserEnrolledInClassroom(classroomId, uid) {
    if (DEMO_MODE) return true;

    const snapshot = await classroomMembersCollection
        .where('classroomId', '==', classroomId)
        .where('uid', '==', uid)
        .limit(1)
        .get();

    return !snapshot.empty;
}

async function enrollStudentByCode(classCode, studentUid, studentName) {
    if (DEMO_MODE) return { success: true };

    const classroom = await getClassroomByCode(classCode);
    if (!classroom) {
        return { success: false, message: 'Classroom not found' };
    }

    const already = await isUserEnrolledInClassroom(classroom.id, studentUid);
    if (already) {
        return { success: false, message: 'You are already enrolled in this classroom' };
    }

    await classroomMembersCollection.doc(classroomMemberDocId(studentUid, classroom.id)).set({
        classroomId: classroom.id,
        uid: studentUid,
        displayName: studentName,
        role: 'student',
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: studentUid
    });

    return { success: true, classroom };
}

async function addStudentToClassroomByUsername(classroomId, username, teacherUid) {
    if (DEMO_MODE) return { success: true };

    const user = await findUserByDisplayName(username);
    if (!user || user.role !== 'student') {
        return { success: false, message: 'Student username not found' };
    }

    const already = await isUserEnrolledInClassroom(classroomId, user.id);
    if (already) {
        return { success: false, message: 'Student already enrolled in this classroom' };
    }

    await classroomMembersCollection.doc(classroomMemberDocId(user.id, classroomId)).set({
        classroomId,
        uid: user.id,
        displayName: user.displayName,
        role: 'student',
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: teacherUid
    });

    return { success: true, student: user };
}

async function getClassroomMembers(classroomId, role = null) {
    if (DEMO_MODE) return [];

    let query = classroomMembersCollection.where('classroomId', '==', classroomId);
    if (role) query = query.where('role', '==', role);

    const snapshot = await query.get();
    const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    members.sort((a, b) => (a.enrolledAt?.toMillis?.() || 0) - (b.enrolledAt?.toMillis?.() || 0));
    return members;
}

async function removeStudentFromClassroom(classroomId, studentUid) {
    if (DEMO_MODE) return;

    const snapshot = await classroomMembersCollection
        .where('classroomId', '==', classroomId)
        .where('uid', '==', studentUid)
        .where('role', '==', 'student')
        .get();

    for (const doc of snapshot.docs) {
        await doc.ref.delete();
    }
}

async function getClassroomQuizzes(classroomId) {
    if (DEMO_MODE) return [];

    const snapshot = await quizzesCollection
        .where('classroomId', '==', classroomId)
        .where('status', '==', 'active')
        .get();

    const quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    quizzes.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return quizzes;
}

async function updateQuiz(quizId, updates) {
    if (DEMO_MODE) return;
    await quizzesCollection.doc(quizId).update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function deleteQuiz(quizId) {
    if (DEMO_MODE) return;

    const sessions = await quizSessionsCollection.where('quizId', '==', quizId).get();
    for (const doc of sessions.docs) {
        await doc.ref.delete();
    }

    await quizzesCollection.doc(quizId).delete();
}

async function getClassroomQuizSessions(classroomId) {
    if (DEMO_MODE) return [];

    const snapshot = await quizSessionsCollection
        .where('classroomId', '==', classroomId)
        .get();

    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    sessions.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return sessions;
}

async function getClassroomLeaderboard(classroomId) {
    const enrolledStudents = await getClassroomMembers(classroomId, 'student');
    const enrolledSet = new Set(enrolledStudents.map(s => s.uid));
    const sessions = await getClassroomQuizSessions(classroomId);
    const stats = {};

    sessions.forEach(session => {
        const p1 = session.players?.player1 || null;
        const p2 = session.players?.player2 || null;
        const players = [p1, p2].filter(Boolean);

        let winnerUid = session.winnerUid || null;
        if (!winnerUid && session.winner && session.winner !== 'Tie') {
            if (p1?.name === session.winner) winnerUid = p1?.uid || null;
            if (p2?.name === session.winner) winnerUid = p2?.uid || null;
        }

        players.forEach((player, index) => {
            if (!player.uid) return;
            if (!enrolledSet.has(player.uid)) return;
            if (!stats[player.uid]) {
                stats[player.uid] = {
                    uid: player.uid,
                    name: player.name,
                    games: 0,
                    wins: 0,
                    losses: 0,
                    totalCorrect: 0,
                    totalQuestions: 0,
                    cardBonusPoints: 0,
                    totalScore: 0,
                    accuracy: 0
                };
            }

            const correct = player.answers?.filter(a => a.correct).length || 0;
            const total = player.answers?.length || 0;
            const quizPoints = correct;
            const playerKey = index === 0 ? 'player1' : 'player2';
            const cardScore = Number(session.finalScores?.[playerKey]) || 0;
            const isCompletedGame = session.status === 'completed' || !!session.finalScores;
            const isWinner = !!winnerUid && player.uid === winnerUid;

            if (isCompletedGame) stats[player.uid].games += 1;
            if (isWinner) stats[player.uid].wins += 1;
            if (isCompletedGame && winnerUid && !isWinner) stats[player.uid].losses += 1;
            stats[player.uid].totalCorrect += correct;
            stats[player.uid].totalQuestions += total;
            stats[player.uid].totalScore += quizPoints;
            if (isWinner && cardScore > 0) {
                stats[player.uid].cardBonusPoints += cardScore;
                stats[player.uid].totalScore += cardScore;
            }
        });
    });

    const leaderboard = Object.values(stats).map(entry => ({
        ...entry,
        accuracy: entry.totalQuestions > 0 ? Math.round((entry.totalCorrect / entry.totalQuestions) * 100) : 0
    }));

    leaderboard.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return b.totalCorrect - a.totalCorrect;
    });

    return leaderboard;
}

function listenToClassroom(classroomId, callback) {
    if (DEMO_MODE) return () => {};
    return classroomsCollection.doc(classroomId).onSnapshot(doc => {
        if (doc.exists) callback({ id: doc.id, ...doc.data() });
    });
}

function listenToClassroomMembers(classroomId, callback) {
    if (DEMO_MODE) return () => {};
    return classroomMembersCollection
        .where('classroomId', '==', classroomId)
        .onSnapshot(snapshot => {
            const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(members);
        });
}

function listenToClassroomQuizzes(classroomId, callback) {
    if (DEMO_MODE) return () => {};
    return quizzesCollection
        .where('classroomId', '==', classroomId)
        .where('status', '==', 'active')
        .onSnapshot(snapshot => {
            const quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(quizzes);
        });
}

function listenToClassroomQuizSessions(classroomId, callback) {
    if (DEMO_MODE) return () => {};
    return quizSessionsCollection
        .where('classroomId', '==', classroomId)
        .onSnapshot(snapshot => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(sessions);
        });
}

async function ensureLegacyClassroomOne() {
    if (DEMO_MODE) return null;

    const legacyQuizSnapshot = await quizzesCollection
        .where('status', '==', 'active')
        .get();

    const legacyQuizzes = legacyQuizSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(quiz => !quiz.classroomId);

    if (legacyQuizzes.length === 0) return null;

    const byTeacher = {};
    legacyQuizzes.forEach(quiz => {
        if (!byTeacher[quiz.teacherUid]) byTeacher[quiz.teacherUid] = [];
        byTeacher[quiz.teacherUid].push(quiz);
    });

    const migratedClassrooms = [];

    for (const [teacherUid, quizzes] of Object.entries(byTeacher)) {
        const teacherName = quizzes[0]?.teacherName || 'Teacher';
        const seedKey = `CLASSROOM_1_LEGACY_${teacherUid}`;

        const existing = await classroomsCollection
            .where('seedKey', '==', seedKey)
            .limit(1)
            .get();

        let classroomId;
        let classroomCode;

        if (existing.empty) {
            const created = await createClassroom(teacherUid, teacherName, {
                name: 'Classroom 1',
                description: 'AI tutorial',
                subject: 'Introduction to Artificial Intelligence'
            });
            classroomId = created.id;
            classroomCode = created.code;
            await classroomsCollection.doc(classroomId).update({ seedKey });
        } else {
            const doc = existing.docs[0];
            classroomId = doc.id;
            classroomCode = doc.data().code;
        }

        for (const quiz of quizzes) {
            await quizzesCollection.doc(quiz.id).update({
                classroomId,
                classroomName: 'Classroom 1',
                classroomCode,
                accessMode: 'classroom',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const sessions = await quizSessionsCollection.where('quizId', '==', quiz.id).get();
            for (const sessionDoc of sessions.docs) {
                const sessionData = sessionDoc.data();
                await sessionDoc.ref.update({
                    classroomId,
                    classroomName: 'Classroom 1',
                    quizTitle: quiz.title || sessionData.quizTitle || 'Quiz',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const p1 = sessionData.players?.player1;
                const p2 = sessionData.players?.player2;
                if (p1?.uid) {
                    const existsP1 = await isUserEnrolledInClassroom(classroomId, p1.uid);
                    if (!existsP1) {
                        await classroomMembersCollection.doc(classroomMemberDocId(p1.uid, classroomId)).set({
                            classroomId,
                            uid: p1.uid,
                            displayName: p1.name || 'Student',
                            role: 'student',
                            enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
                            addedBy: teacherUid
                        });
                    }
                }
                if (p2?.uid) {
                    const existsP2 = await isUserEnrolledInClassroom(classroomId, p2.uid);
                    if (!existsP2) {
                        await classroomMembersCollection.doc(classroomMemberDocId(p2.uid, classroomId)).set({
                            classroomId,
                            uid: p2.uid,
                            displayName: p2.name || 'Student',
                            role: 'student',
                            enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
                            addedBy: teacherUid
                        });
                    }
                }
            }
        }

        migratedClassrooms.push({ classroomId, classroomCode, teacherUid });
    }

    return migratedClassrooms;
}

// ========================================
// ADMIN USER MANAGEMENT FUNCTIONS
// ========================================

async function requireAdminSession() {
    if (DEMO_MODE) {
        return { uid: 'demo-admin', role: 'admin' };
    }

    if (!auth || !auth.currentUser) {
        throw new Error('You must be signed in as admin.');
    }

    const me = await getUserByUid(auth.currentUser.uid);
    if (!me || me.role !== 'admin') {
        throw new Error('Admin access required.');
    }

    return me;
}

async function getAllUsersForAdmin(options = {}) {
    if (DEMO_MODE) return [];
    await requireAdminSession();

    const legacyLimit = typeof options === 'number' ? options : null;
    const includeDeleted = typeof options === 'object'
        ? options.includeDeleted === true
        : false;
    const maxDocs = Math.max(1, Math.min(Number(legacyLimit ?? options.maxDocs ?? 1000) || 1000, 10000));
    const pageSize = Math.max(50, Math.min(Number(options.pageSize ?? 400) || 400, 500));

    const users = [];
    let lastDocId = null;

    while (users.length < maxDocs) {
        let query = usersCollection
            .orderBy(firebase.firestore.FieldPath.documentId())
            .limit(Math.min(pageSize, maxDocs - users.length));

        if (lastDocId) {
            query = query.startAfter(lastDocId);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        snapshot.docs.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        lastDocId = snapshot.docs[snapshot.docs.length - 1].id;
        if (snapshot.size < Math.min(pageSize, maxDocs - users.length)) break;
    }

    const filtered = includeDeleted
        ? users
        : users.filter(user => !(user.isDeleted === true || user.status === 'deleted'));

    filtered.sort((a, b) => {
        const aName = (a.displayName || a.email || a.uid || a.id || '').toString().toLowerCase();
        const bName = (b.displayName || b.email || b.uid || b.id || '').toString().toLowerCase();
        return aName.localeCompare(bName);
    });

    return filtered;
}

async function findUsersByIdentifier(identifier, includeDeleted = false) {
    if (DEMO_MODE) return [];
    await requireAdminSession();

    const normalizedNeedle = normalizeSearchText(identifier);
    const compactNeedle = compactSearchText(identifier);
    if (!normalizedNeedle) return [];

    const users = await getAllUsersForAdmin({ includeDeleted: true, maxDocs: 10000, pageSize: 400 });
    const scored = [];

    for (const user of users) {
        const isDeleted = user.isDeleted === true || user.status === 'deleted';
        if (!includeDeleted && isDeleted) continue;

        const displayName = normalizeSearchText(user.displayName || user.displayNameLower || '');
        const email = normalizeSearchText(user.email || user.emailLower || '');
        const uid = normalizeSearchText(user.uid || user.id || '');

        const displayCompact = compactSearchText(displayName);
        const emailCompact = compactSearchText(email);
        const uidCompact = compactSearchText(uid);

        const isExact =
            displayName === normalizedNeedle ||
            email === normalizedNeedle ||
            uid === normalizedNeedle ||
            displayCompact === compactNeedle ||
            emailCompact === compactNeedle ||
            uidCompact === compactNeedle;

        const isPrefix =
            displayName.startsWith(normalizedNeedle) ||
            email.startsWith(normalizedNeedle) ||
            uid.startsWith(normalizedNeedle) ||
            displayCompact.startsWith(compactNeedle) ||
            emailCompact.startsWith(compactNeedle) ||
            uidCompact.startsWith(compactNeedle);

        const isContains =
            displayName.includes(normalizedNeedle) ||
            email.includes(normalizedNeedle) ||
            uid.includes(normalizedNeedle) ||
            displayCompact.includes(compactNeedle) ||
            emailCompact.includes(compactNeedle) ||
            uidCompact.includes(compactNeedle);

        if (!isExact && !isPrefix && !isContains) continue;

        const score = isExact ? 300 : (isPrefix ? 200 : 100);
        scored.push({ user, score, isDeleted });
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.isDeleted !== b.isDeleted) return a.isDeleted ? 1 : -1;

        const aName = normalizeSearchText(a.user.displayName || a.user.email || a.user.uid || a.user.id || '');
        const bName = normalizeSearchText(b.user.displayName || b.user.email || b.user.uid || b.user.id || '');
        return aName.localeCompare(bName);
    });

    return scored.slice(0, 100).map(item => item.user);
}

function normalizeIdentityValue(value) {
    return (value || '').toString().trim().toLowerCase();
}

function normalizeSearchText(value) {
    return normalizeIdentityValue(value).replace(/\s+/g, ' ').trim();
}

function compactSearchText(value) {
    return normalizeSearchText(value).replace(/\s+/g, '');
}

async function assertUniqueActiveUserIdentity({ displayName, email, excludeUid = null }) {
    const normalizedDisplayName = normalizeIdentityValue(displayName);
    const normalizedEmail = normalizeIdentityValue(email);

    if (!normalizedDisplayName && !normalizedEmail) return;

    const snapshot = await usersCollection.limit(1000).get();
    for (const docSnap of snapshot.docs) {
        if (excludeUid && docSnap.id === excludeUid) continue;

        const user = docSnap.data() || {};
        const isDeleted = user.isDeleted === true || user.status === 'deleted';
        if (isDeleted) continue;

        if (normalizedDisplayName) {
            const userDisplayName = normalizeIdentityValue(user.displayName);
            if (userDisplayName && userDisplayName === normalizedDisplayName) {
                throw new Error('Display name is already used by another account.');
            }
        }

        if (normalizedEmail) {
            const userEmail = normalizeIdentityValue(user.email);
            if (userEmail && userEmail === normalizedEmail) {
                throw new Error('Email is already used by another account.');
            }
        }
    }
}

async function adminUpdateUserByUid(targetUid, updates) {
    if (DEMO_MODE) return;
    await requireAdminSession();

    if (!targetUid) {
        throw new Error('Target user UID is required.');
    }

    const allowed = {};
    const nextRole = updates?.role;
    const nextDisplayName = typeof updates?.displayName === 'string' ? updates.displayName.trim() : '';
    const nextEmail = typeof updates?.email === 'string' ? updates.email.trim() : '';

    const targetRef = usersCollection.doc(targetUid);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
        throw new Error('Target user profile not found.');
    }

    await assertUniqueActiveUserIdentity({
        displayName: nextDisplayName || null,
        email: nextEmail || null,
        excludeUid: targetUid
    });

    if (typeof updates?.displayName === 'string') {
        allowed.displayName = nextDisplayName;
        allowed.displayNameLower = normalizeIdentityValue(nextDisplayName);
    }
    if (typeof updates?.email === 'string') {
        allowed.email = nextEmail;
        allowed.emailLower = normalizeIdentityValue(nextEmail);
    }
    if (typeof nextRole === 'string' && ['student', 'teacher', 'admin'].includes(nextRole)) {
        allowed.role = nextRole;
    }

    if (Object.keys(allowed).length === 0) {
        throw new Error('No valid user fields to update.');
    }

    await targetRef.update(allowed);
}

async function adminAssignRoleByUid(targetUid, role) {
    return adminUpdateUserByUid(targetUid, { role });
}

async function adminDeleteUserByUid(targetUid) {
    if (DEMO_MODE) return { deletedFirestoreDoc: true, deletedAuthAccount: false };

    await requireAdminSession();

    if (!targetUid) {
        throw new Error('Target user UID is required.');
    }

    const targetRef = usersCollection.doc(targetUid);
    const targetSnapshot = await targetRef.get();

    let targetDocRef = targetRef;
    let existingData = targetSnapshot.exists ? targetSnapshot.data() : null;

    if (!existingData) {
        const byUid = await usersCollection.where('uid', '==', targetUid).limit(1).get();
        if (!byUid.empty) {
            targetDocRef = byUid.docs[0].ref;
            existingData = byUid.docs[0].data();
        }
    }

    if (!existingData) {
        throw new Error('User profile not found.');
    }

    const resolvedUid = (existingData.uid || targetDocRef.id || '').toString().trim();
    if (!resolvedUid) {
        throw new Error('Resolved UID is missing for target user.');
    }

    if (auth.currentUser && resolvedUid === auth.currentUser.uid) {
        throw new Error('You cannot delete your own admin account.');
    }

    await targetDocRef.set({
        uid: resolvedUid,
        email: existingData.email || null,
        displayName: existingData.displayName || null,
        role: existingData.role || null,
        isDeleted: true,
        status: 'deleted',
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedByUid: auth.currentUser ? auth.currentUser.uid : null
    }, { merge: true });

    return { deletedFirestoreDoc: true, deletedAuthAccount: false, softDeleted: true };
}

async function adminRestoreUserByUid(targetUid) {
    if (DEMO_MODE) return { restored: true };

    await requireAdminSession();

    if (!targetUid) {
        throw new Error('Target user UID is required.');
    }

    const targetRef = usersCollection.doc(targetUid);
    const targetSnapshot = await targetRef.get();

    let targetDocRef = targetRef;
    let existingData = targetSnapshot.exists ? targetSnapshot.data() : null;

    if (!existingData) {
        const byUid = await usersCollection.where('uid', '==', targetUid).limit(1).get();
        if (!byUid.empty) {
            targetDocRef = byUid.docs[0].ref;
            existingData = byUid.docs[0].data();
        }
    }

    if (!existingData) {
        throw new Error('User profile not found.');
    }

    const resolvedUid = (existingData.uid || targetDocRef.id || '').toString().trim();
    if (!resolvedUid) {
        throw new Error('Resolved UID is missing for target user.');
    }

    await targetDocRef.set({
        uid: resolvedUid,
        isDeleted: false,
        status: 'active',
        deletedAt: firebase.firestore.FieldValue.delete(),
        deletedByUid: firebase.firestore.FieldValue.delete()
    }, { merge: true });

    return { restored: true };
}

async function adminSendPasswordReset(email) {
    if (DEMO_MODE) return;
    await requireAdminSession();

    const safeEmail = (email || '').trim();
    if (!safeEmail) {
        throw new Error('Email is required to send password reset.');
    }

    await auth.sendPasswordResetEmail(safeEmail);
}

async function getAllActiveClassroomsForAdmin() {
    if (DEMO_MODE) return [];
    await requireAdminSession();

    const snapshot = await classroomsCollection
        .where('status', '==', 'active')
        .get();

    const classrooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    classrooms.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return classrooms;
}

async function createAdminQuizForAllClassrooms(adminUid, adminName, quizData) {
    if (DEMO_MODE) {
        return {
            appliedCount: 1,
            skippedCount: 0,
            totalClassrooms: 1,
            appliedClassrooms: [{ id: 'demo-class', name: 'Demo Classroom' }]
        };
    }

    await requireAdminSession();

    const title = (quizData?.title || '').trim();
    const description = (quizData?.description || '').trim();
    const rounds = quizData?.rounds;

    if (!title) {
        throw new Error('Quiz title is required.');
    }
    if (!Array.isArray(rounds) || rounds.length === 0) {
        throw new Error('At least one round is required.');
    }

    const classrooms = await getAllActiveClassroomsForAdmin();
    if (!classrooms.length) {
        throw new Error('No active classrooms found.');
    }

    const appliedClassrooms = [];
    let skippedCount = 0;

    for (const classroom of classrooms) {
        if (!classroom.id) {
            skippedCount += 1;
            continue;
        }

        await createQuiz(adminUid, adminName, {
            title,
            description,
            rounds: JSON.parse(JSON.stringify(rounds)),
            classroomId: classroom.id,
            classroomName: classroom.name || 'Classroom',
            classroomCode: classroom.code || null
        });

        appliedClassrooms.push({ id: classroom.id, name: classroom.name || 'Classroom' });
    }

    return {
        appliedCount: appliedClassrooms.length,
        skippedCount,
        totalClassrooms: classrooms.length,
        appliedClassrooms
    };
}

// ========================================
// PROFILE PICTURE FUNCTIONS
// ========================================

// Save profile picture (base64 data URL) to Firestore user document
async function saveProfilePicture(uid, base64DataUrl) {
    if (DEMO_MODE) return;
    
    try {
        await usersCollection.doc(uid).update({
            profilePicture: base64DataUrl,
            profilePicUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Profile picture saved to Firebase");
    } catch (error) {
        console.error("Error saving profile picture:", error);
    }
}

// Get profile picture for a user by UID
async function getProfilePicture(uid) {
    if (DEMO_MODE) return null;
    
    try {
        const userDoc = await usersCollection.doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data().profilePicture || null;
        }
        return null;
    } catch (error) {
        console.error("Error getting profile picture:", error);
        return null;
    }
}

// Initialize Firebase when the script loads
// Use both DOMContentLoaded and immediate check in case DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
    // DOM is already loaded, initialize immediately
    initializeFirebase();
}
