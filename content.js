const BACKEND_API_URL = "https://chrome-extension-rating.onrender.com/predict";

function getContestIdFromUrl() {
    let match = window.location.pathname.match(/contest\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

async function getContestStartTime(contestId) {

    try {
        let response = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`);
        let data = await response.json();

        if (data.status === "OK" && data.result && data.result.contest && data.result.contest.startTimeSeconds) {
            return data.result.contest.startTimeSeconds;
        } else {
            console.error("Failed to fetch contest start time.", data);
            return null;
        }
    } catch (error) {
        console.error("Error fetching contest start time:", error);
        return null;
    }
}

function getSolversPerProblem() {
    let solvers = {};
    document.querySelectorAll(".problems tr").forEach(row => {
        let problemCell = row.querySelector("td.id a");
        let solversCell = row.querySelector("td a[title='Participants solved the problem']");
        
        if (problemCell && solversCell) {
            let problemLetter = problemCell.textContent.trim();
            let solverCount = parseInt(solversCell.textContent.replace(/\D/g, "")) || 0;
            solvers[problemLetter] = solverCount;
        }
    });
    return solvers;
}

async function fetchContestData(contestId) {
    let contestStartTime = await getContestStartTime(contestId);
    if (!contestStartTime) return;
    
    let currentTime = Math.floor(Date.now() / 1000);
    let elapsedTime = currentTime - contestStartTime;
    let solversPerProblem = getSolversPerProblem();
    let peopleSolvedA = solversPerProblem["A"] || 0;
    let problemLetters = Object.keys(solversPerProblem);

    let result = problemLetters.map((problemLetter, index) => ({
        "time": Math.min(Math.floor(elapsedTime / 60), 120),
        "people_solved_A": peopleSolvedA,
        "solved_at_time": solversPerProblem[problemLetter] || 0,
        "question_number": index + 1
    }));

    let res = await sendDataToBackend(contestId, result);
    displayResultsInUI(res);
}

async function sendDataToBackend(contestId, results) {
    let allResponses = {}; // Store responses in { A: 800, B: 1200, ... } format
    const problems = ["A", "B", "C", "D", "E", "F", "G"]; // Define problem letters

    for (let i = 0; i < results.length; i++) {
        try {
            let response = await fetch(BACKEND_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(results[i]) // Send one question at a time
            });

            let responseData = await response.json();
            console.log(`✔️ Data sent to backend successfully for problem ${problems[i]}:`, responseData);

            if (responseData.predicted_rating !== undefined) {
                allResponses[problems[i]] = Math.round(responseData.predicted_rating); // Store rounded rating
            } else {
                console.warn(`⚠️ No predicted rating received for problem ${problems[i]}`);
            }

        } catch (error) {
            console.error(`❌ Error sending data to backend for problem ${problems[i]}:`, error);
        }
    }

    console.log("📊 All Responses:", allResponses);
    return allResponses;
}

function getRatingColor(rating) {
    if (rating < 1200) return "#808080";        // Newbie
    if (rating < 1400) return "#008000";       // Pupil
    if (rating < 1600) return "#03A89E";        // Specialist
    if (rating < 1900) return "#0000ff";        // Expert
    if (rating < 2100) return "#aa00aa";      // Candidate Master
    if (rating < 2400) return "#ff8c00";      // Master
    return "#ff0000";                            // Grandmaster+
}

function displayResultsInUI(predictions) {
    let table = document.querySelector(".problems");
    
    if (!table) {
        console.error("❌ Problems table not found!");
        return;
    }

    let firstRow = table.querySelector("tbody tr");

    if (!firstRow) {
        console.error("❌ Table header row not found!");
        return;
    }

    // Check if the column is already added to prevent duplication
    if (!firstRow.querySelector(".prediction-column")) {
        let newHeader = document.createElement("th");
        // newHeader.textContent = "Prediction";
        newHeader.style.width = "60px";
        newHeader.classList.add("prediction-column");
        firstRow.appendChild(newHeader);
    }

    // Select all rows except the header
    let rows = table.querySelectorAll("tbody tr:not(:first-child)");

    console.log("predictions: ", predictions);

    rows.forEach((row) => {
        let problemId = row.querySelector("td.id a")?.textContent.trim();

        // Ensure problem exists and prediction is available
        if (!problemId || !(problemId in predictions)) {
            console.warn(`⚠️ Prediction not found for problem ${problemId}`);
            return;
        }

        let rating = predictions[problemId];
        let color = getRatingColor(rating);

        // Check if prediction column already exists
        let existingPredictionCell = row.querySelector(".prediction-cell");
        if (existingPredictionCell) {
            existingPredictionCell.textContent = rating;
            existingPredictionCell.style.color = color;
            existingPredictionCell.style.fontWeight = "bold";
        } else {
            let newCell = document.createElement("td");
            newCell.textContent = rating;
            newCell.classList.add("prediction-cell");
            newCell.style.color = color;  // Apply color
            // newHeader.style.width = "60px";
            newCell.style.fontSize = "12px";  // Reduce font size
            newCell.style.textAlign = "center";
            newCell.style.width = "60px"
            newCell.style.fontWeight = "bold";
            row.appendChild(newCell);
        }
    });

    console.log("✔️ Predictions displayed successfully!");
}
(async function () {
    let contestId = getContestIdFromUrl();
    if (contestId) {
        await fetchContestData(contestId);
    }
})();
