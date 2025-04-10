document.addEventListener('DOMContentLoaded', () => {
    const matchGrid = document.getElementById('matchGrid');
    const showBestXIButton = document.getElementById('showBestXI');
    const teamDisplay = document.getElementById('teamDisplay');
    const mustPickPlayerDropdown = document.getElementById('mustPickPlayer');
    let selectedMatch = null;
    let fantasyData = [];
    let mustIncludePlayers = [];

    // Load matches from IPL_2025_Schedule.txt
    fetch('./IPL_2025_Schedule.txt')
        .then(response => response.text())
        .then(data => {
            // Clear existing matches
            matchGrid.innerHTML = '';
            
            // Error #1: Need to properly filter match data to ensure only valid match entries are included
            const matches = data.split('\n')
                .filter(line => line.trim() !== '' && line.match(/^M\d+/))
                .map(line => line.trim());

            // Create and append match elements
            // Error #2: Check if matches array is empty and provide feedback
            if (matches.length === 0) {
                matchGrid.innerHTML = '<div class="error-message">No valid matches found in schedule file.</div>';
                return;
            }
            
            matches.forEach((match, index) => {
                const matchElement = document.createElement('div');
                matchElement.className = 'match-item';
                matchElement.textContent = match;
                matchElement.setAttribute('data-match-index', index);
                
                matchElement.addEventListener('click', () => {
                    // Remove selection from all matches
                    document.querySelectorAll('.match-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    
                    // Add selection to clicked match
                    matchElement.classList.add('selected');
                    selectedMatch = match;
                    
                    // Extract teams and update player dropdown
                    const matchPattern = /M\d+ - (.+) vs (.+)/;
                    const teams = match.match(matchPattern);
                    if (teams && teams.length === 3) {
                        const team1 = teams[1].trim();
                        const team2 = teams[2].trim();
                        updateMustPickPlayerDropdown(team1, team2);
                    }
                });
                
                matchGrid.appendChild(matchElement);
            });

            // Ensure the match grid is scrollable
            matchGrid.style.overflowY = 'auto';
            matchGrid.style.maxHeight = '300px';
        })
        .catch(error => {
            console.error('Error loading schedule:', error);
            matchGrid.innerHTML = '<div class="error-message">Failed to load matches. Please try again.</div>';
        });

    // Load fantasy data
    fetch('./IPL_FantasyData.csv')
        .then(response => response.text())
        .then(data => {
            fantasyData = parseCSV(data);
        })
        .catch(error => console.error('Error loading fantasy data:', error));

    function updateMustPickPlayerDropdown(team1, team2) {
        const mustPickDropdown = document.getElementById('mustPickPlayer');
        mustPickDropdown.innerHTML = '<option value="">Player You Must Pick</option>';
        
        // Error #3: Fix CSV parsing for Must Include Player.csv
        fetch('./Must Include Player.csv')
            .then(response => response.text())
            .then(data => {
                const rows = data.split('\n');
                // Get headers to determine column positions
                const headers = rows[0].split(',').map(h => h.trim());
                const playerNameIndex = headers.indexOf('Best_5_players');
                const teamIndex = headers.indexOf('Current_Team');
                
                if (playerNameIndex === -1 || teamIndex === -1) {
                    console.error('CSV headers not found in expected format');
                    mustPickDropdown.innerHTML = '<option value="">Error loading player data</option>';
                    mustPickDropdown.disabled = true;
                    return;
                }
                
                const players = rows.slice(1)
                    .filter(row => row.trim() !== '')
                    .map(row => {
                        const values = row.split(',').map(val => val.trim());
                        return { 
                            name: values[playerNameIndex], 
                            team: values[teamIndex]
                        };
                    })
                    .filter(player => player.team === team1 || player.team === team2);
    
                if (players.length === 0) {
                    mustPickDropdown.innerHTML = '<option value="">No players available for selected teams</option>';
                    mustPickDropdown.disabled = true;
                    return;
                }
    
                players.forEach(player => {
                    const option = document.createElement('option');
                    option.value = player.name;
                    option.textContent = `${player.name} (${player.team})`;
                    mustPickDropdown.appendChild(option);
                });
    
                // Error #4: Fix multiple selection configuration
                mustPickDropdown.multiple = true;
                mustPickDropdown.size = Math.min(5, players.length);
                mustPickDropdown.disabled = false;
            })
            .catch(error => {
                console.error('Error loading Must Include Player data:', error);
                mustPickDropdown.innerHTML = '<option value="">Error loading player data</option>';
                mustPickDropdown.disabled = true;
            });
    }

    showBestXIButton.addEventListener('click', () => {
        if (!selectedMatch) {
            alert('Please select a match first!');
            return;
        }

        const selectedOptions = Array.from(mustPickPlayerDropdown.selectedOptions);
        const selectedPlayers = selectedOptions.map(option => option.value);

        const matchPattern = /M\d+ - (.+) vs (.+)/;
        const teams = selectedMatch.match(matchPattern);
        if (!teams || teams.length !== 3) {
            alert('Invalid match format!');
            return;
        }

        const team1 = teams[1].trim();
        const team2 = teams[2].trim();

        const bestXI = selectBestXI(
            fantasyData,
            team1,
            team2,
            selectedPlayers,
            document.getElementById('riskRating').value,
            document.getElementById('teamPreference').value
        );

        displayTeam(bestXI);
        teamDisplay.style.display = 'block';
    });

    function parseCSV(csv) {
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1)
            .filter(line => line.trim() !== '')
            .map(line => {
                const values = line.split(',').map(v => v.trim());
                const player = {};
                headers.forEach((header, index) => {
                    player[header] = values[index] || '';
                });
                return player;
            });
    }

    function selectBestXI(players, team1, team2, mustIncludePlayers, riskRating, teamPreference) {
        // Filter players from selected teams and 2024 season
        let availablePlayers = players.filter(p => 
            (p.Current_Team === team1 || p.Current_Team === team2) &&
            p.season === '2024'
        );

        // Create a copy of available players for must-include matching
        const allTeamPlayers = [...availablePlayers];

        // Apply risk rating filter if selected
        if (riskRating) {
            availablePlayers = availablePlayers.filter(p => p['Risk.Rating'] === riskRating);
        }

        // Sort players based on team preference
        availablePlayers.sort((a, b) => {
            if (teamPreference === 'consistency') {
                return parseFloat(b.Consistency_Rating || 0) - parseFloat(a.Consistency_Rating || 0);
            } else if (teamPreference === 'upside') {
                return parseFloat(b.Upside_Score || 0) - parseFloat(a.Upside_Score || 0);
            }
            return parseFloat(b.Total_FP || 0) - parseFloat(a.Total_FP || 0);
        });

        // Required positions count
        const required = {
            Batsman: 4,
            Wicketkeeper: 1,
            Allrounder: 2,
            Bowler: 4
        };

        let finalTeam = [];

        // Helper function to find a player by name with flexible matching
        function findPlayerByName(playerName, playersList) {
            // Try exact match first
            let player = playersList.find(p => 
                p.fullName && p.fullName.toLowerCase() === playerName.toLowerCase()
            );
            
            // If no exact match, try partial match
            if (!player) {
                player = playersList.find(p => 
                    p.fullName && p.fullName.toLowerCase().includes(playerName.toLowerCase())
                );
            }
            
            // If still no match, try matching parts of the name
            if (!player) {
                const nameParts = playerName.toLowerCase().split(' ');
                player = playersList.find(p => {
                    if (!p.fullName) return false;
                    const fullNameLower = p.fullName.toLowerCase();
                    return nameParts.some(part => fullNameLower.includes(part));
                });
            }
            
            return player;
        }

        // First, include must-include players
        if (mustIncludePlayers && mustIncludePlayers.length > 0) {
            mustIncludePlayers.forEach(playerName => {
                // Try to find player in available players first
                let player = findPlayerByName(playerName, availablePlayers);
                
                // If not found in filtered list, try in all team players
                if (!player && riskRating) {
                    player = findPlayerByName(playerName, allTeamPlayers);
                    console.log(`Found must-include player outside risk filter: ${playerName}`);
                }
                
                if (player) {
                    finalTeam.push(player);
                    // Remove from both lists to avoid duplicates
                    availablePlayers = availablePlayers.filter(p => p.fullName !== player.fullName);
                    
                    // Update required positions based on included player's position
                    if (required[player.position] > 0) {
                        required[player.position]--;
                    }
                } else {
                    console.warn(`Could not find player: ${playerName} in selected teams`);
                }
            });
        }

        // Count current positions
        const current = {
            Batsman: finalTeam.filter(p => p.position === 'Batsman').length,
            Wicketkeeper: finalTeam.filter(p => p.position === 'Wicketkeeper').length,
            Allrounder: finalTeam.filter(p => p.position === 'Allrounder').length,
            Bowler: finalTeam.filter(p => p.position === 'Bowler').length
        };

        // Fill remaining positions
        ['Wicketkeeper', 'Batsman', 'Allrounder', 'Bowler'].forEach(position => {
            while (current[position] < required[position] && availablePlayers.length > 0) {
                const player = availablePlayers.find(p => p.position === position);
                if (player) {
                    finalTeam.push(player);
                    availablePlayers = availablePlayers.filter(p => p.fullName !== player.fullName);
                    current[position]++;
                } else {
                    break;
                }
            }
        });

        // Fill any remaining slots with best available players
        while (finalTeam.length < 11 && availablePlayers.length > 0) {
            finalTeam.push(availablePlayers[0]);
            availablePlayers = availablePlayers.slice(1);
        }

        return finalTeam;
    }

    function displayTeam(team) {
        teamDisplay.innerHTML = '';
        
        const positions = ['Batsman', 'Wicketkeeper', 'Allrounder', 'Bowler'];
        positions.forEach(position => {
            const positionPlayers = team.filter(player => player.position === position);
            if (positionPlayers.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'position-category';
                categoryDiv.innerHTML = `
                    <h2>${position === 'Batsman' ? 'Batsmen' : `${position}s`} (${positionPlayers.length})</h2>
                    <div class="player-grid">
                        ${positionPlayers.map(player => `
                            <div class="player-card">
                                <div class="player-silhouette"></div>
                                <h3>${player.fullName}</h3>
                                <p>Team: ${player.Current_Team}</p>
                                <p>Position: ${player.position}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
                teamDisplay.appendChild(categoryDiv);
            }
        });
    }
});