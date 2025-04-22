import express from "express";
const app = express();
import cors from "cors";
import Player from './models/player.js';
import { syncModels } from "./models/index.js";
import OpenAI from "openai";

const PORT = 3001;

// CORS and JSON middleware
app.use(cors());
app.use(express.json());

// Initialize models
syncModels();

// OpenAI setup - Replace "YOUR_OPENAI_API_KEY_HERE" with your actual API key
const OPENAI_API_KEY = "KEY HERE";
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const aiModel = "gpt-4-turbo-preview";

// Game API endpoint
app.get("/api/game", async (req, res) => {
  const boardJson = req.query.board;

  if (!boardJson || !boardJson.length) {
    return res.status(400).json({ error: "Missing or invalid board input." });
  }

  const prompt = [];
  prompt.push('You are an expert tic tac toe player that only moves when its your turn, making only one move at a time.');
  prompt.push('You play as O. Focus on winning, play extremely well.');
  prompt.push('For the JSON content I provide as input, please give me JSON output in the same format.');
  prompt.push('{board:[[],[],[]]}');

  const messages = [
    {
      role: "system",
      content: prompt.join(" "),
    },
    {
      role: "user",
      content: boardJson,
    },
  ];

  try {
    // Log request to help with debugging
    console.log("Sending request to OpenAI with board:", boardJson);
    
    const completion = await openai.chat.completions.create({
      model: aiModel,
      messages,
      response_format: { type: "json_object" },
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Log AI response for debugging
    console.log("Received AI response:", aiResponse);
    
    res.json({ aiResponse });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ 
      error: "Failed to generate AI move.",
      details: error.message
    });
  }
});

// PLAYER API ENDPOINTS
// GET endpoint to fetch all players for leaderboard
app.get("/api/player", async (req, res) => {
  try {
    // Find all players and sort by win percentage (desc)
    const players = await Player.findAll({
      order: [
        ['total_wins', 'DESC'],
        ['total_games', 'DESC']
      ]
    });
    return res.json(players);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to fetch players." });
  }
});

// GET endpoint to fetch a specific player by name
app.get("/api/player/:name", async (req, res) => {
  try {
    const playerName = req.params.name;
    const player = await Player.findOne({
      where: { player_id: playerName }
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    
    return res.json(player);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to fetch player." });
  }
});

// POST endpoint to create a new player
app.post("/api/player/create", async (req, res) => {
  try {
    const { playerName } = req.body;
    
    if (!playerName) {
      return res.status(400).json({ error: "Player name is required" });
    }
    
    // Find or create the player
    const [player, created] = await Player.findOrCreate({
      where: { player_id: playerName },
      defaults: {
        total_wins: 0,
        total_losses: 0,
        total_ties: 0,
        total_games: 0
      }
    });
    
    return res.json(player);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to create player." });
  }
});

// POST endpoint to update player statistics
app.post("/api/player/update", async (req, res) => {
  try {
    const { playerName, result } = req.body;
    
    if (!playerName || !result) {
      return res.status(400).json({ error: "Player name and result are required" });
    }
    
    // Find or create the player
    const [player, created] = await Player.findOrCreate({
      where: { player_id: playerName },
      defaults: {
        total_wins: 0,
        total_losses: 0,
        total_ties: 0,
        total_games: 0
      }
    });
    
    // Update the player's statistics based on the game result
    let updateValues = { total_games: player.total_games + 1 };
    
    if (result === 'win') {
      updateValues.total_wins = player.total_wins + 1;
    } else if (result === 'loss') {
      updateValues.total_losses = player.total_losses + 1;
    } else if (result === 'tie') {
      updateValues.total_ties = player.total_ties + 1;
    } else {
      return res.status(400).json({ error: "Invalid result. Must be 'win', 'loss', or 'tie'" });
    }
    
    // Update the player record
    await player.update(updateValues);
    
    return res.json(player);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to update player statistics." });
  }
});

// MOVE API ENDPOINTS
// GET endpoint to fetch all moves
app.get("/api/int", async (req, res) => {
  try {
    const moves = await Move.findAll({
      order: [['createdAt', 'DESC']]
    });
    return res.json(moves);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to fetch move data." });
  }
});

// POST endpoint to log a new move
app.post("/api/int", async (req, res) => {
  try {
    const { player, row, col, gameStatus, timestamp } = req.body;
    
    // Convert row/col to board position format
    const positions = [
      ['top_left', 'top_center', 'top_right'],
      ['middle_left', 'middle_center', 'middle_right'],
      ['bottom_left', 'bottom_center', 'bottom_right']
    ];
    
    const boardPosition = positions[row][col];
    
    // Create a basic game_id (in production you'd have a proper Game model)
    // This uses a timestamp-based ID for simplicity
    const gameId = Math.floor(Date.now() / 1000) % 1000000; // Last 6 digits of timestamp
    
    const newMove = await Move.create({
      game_id: gameId,
      player: player,
      row: row,
      col: col,
      board_position: boardPosition,
      game_status: gameStatus,
      timestamp: timestamp || new Date()
    });
    
    res.status(201).json(newMove);
  } catch (error) {
    console.error("Error logging move:", error);
    res.status(500).json({ error: "Failed to log move: " + error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`API endpoint for AI moves: http://localhost:${PORT}/api/game`);
});