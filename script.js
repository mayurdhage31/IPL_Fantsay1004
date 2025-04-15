document.addEventListener('DOMContentLoaded', () => {
    const matchDropdown = document.getElementById('matchDropdown');
    const showBestXIButton = document.getElementById('showBestXI');
    const teamDisplay = document.getElementById('teamDisplay');
    const mustPickPlayerDropdown = document.getElementById('mustPickPlayer');
    let selectedMatch = null;
    let fantasyData = [];
    let mustIncludePlayers = [];
    let isFirstLoad = true;

    // Load matches from IPL_2025_Schedule.txt
    fetch('./IPL_2025_Schedule.txt')
        .then(response => response.text())
        .then(data => {
            // Clear existing matches
            matchDropdown.innerHTML = '<option value="">Select a match</option>';
            
            // Filter match data to ensure only valid match entries are included
            const matches = data.split('\n')
                .filter(line => line.trim() !== '' && line.match(/^M\d+/))
                .map(line => line.trim());

            // Create and append match options
            if (matches.length === 0) {
                matchDropdown.innerHTML = '<option value="">No valid matches found</option>';
                matchDropdown.disabled = true;
                return;
            }
            
            matches.forEach((match, index) => {
                const option = document.createElement('option');
                option.value = match;
                option.textContent = match;
                matchDropdown.appendChild(option);
            });
            
            // Add event listener to the dropdown
            matchDropdown.addEventListener('change', () => {
                selectedMatch = matchDropdown.value;
                
                if (selectedMatch) {
                    // Extract teams and update player dropdown
                    const matchPattern = /M\d+ - (.+) vs (.+)/;
                    const teams = selectedMatch.match(matchPattern);
                    if (teams && teams.length === 3) {
                        const team1 = teams[1].trim();
                        const team2 = teams[2].trim();
                        updateMustPickPlayerDropdown(team1, team2);
                    }
                } else {
                    // Reset player dropdown if no match is selected
                    mustPickPlayerDropdown.innerHTML = '<option value="">Player You Must Pick</option>';
                    mustPickPlayerDropdown.disabled = true;
                }
            });
        })
        .catch(error => {
            console.error('Error loading schedule:', error);
            matchDropdown.innerHTML = '<option value="">Failed to load matches</option>';
            matchDropdown.disabled = true;
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
        
        // Get selected players from the dropdown
        const selectedOptions = Array.from(mustPickPlayerDropdown.selectedOptions);
        const selectedPlayers = selectedOptions.map(option => option.value);

        // Reset mustIncludePlayers array when changing selection
        mustIncludePlayers = [];
        isFirstLoad = false;
        
        // Add selected players to mustIncludePlayers
        if (selectedPlayers.length > 0) {
            mustIncludePlayers = selectedPlayers;
        }

        const matchPattern = /M\d+ - (.+) vs (.+)/;
        const teams = selectedMatch.match(matchPattern);
        if (!teams || teams.length !== 3) {
            alert('Invalid match format!');
            return;
        }

        const team1 = teams[1].trim();
        const team2 = teams[2].trim();
        
        // Note: We still pass the risk rating and team preference values to the function
        // for consistency, but they won't affect the team selection as per requirements
        const bestXI = selectBestXI(
            fantasyData,
            team1,
            team2,
            selectedPlayers,
            document.getElementById('riskRating').value,
            document.getElementById('teamPreference').value
        );

        displayTeam(bestXI, selectedPlayers);
        teamDisplay.style.display = 'block';
        
        // Add a small notification to inform users that risk rating and team preference
        // are for interaction only and don't affect the Best XI selection
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = 'Note: Risk Rating and Team Preference buttons are for interaction only and do not affect the Best XI selection.';
        notification.style.fontSize = '12px';
        notification.style.color = '#666';
        notification.style.marginTop = '10px';
        notification.style.textAlign = 'center';
        
        // Remove any existing notification before adding a new one
        const existingNotification = teamDisplay.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        teamDisplay.appendChild(notification);
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
        
        // Note: We're keeping the UI elements for Risk Rating and Team Preference
        // but not using them to affect the Best XI selection as per requirements
        // The buttons remain in the interface for user interaction only
        
        // Sort players by Total Fantasy Points by default
        availablePlayers.sort((a, b) => {
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

    function displayTeam(team, mustIncludePlayers = []) {
        teamDisplay.innerHTML = '';
        
        // Create a header for the Best XI
        const headerDiv = document.createElement('div');
        headerDiv.innerHTML = '<h2>Best XI Team</h2>';
        teamDisplay.appendChild(headerDiv);
        
        // Reset first load flag after first display
        isFirstLoad = false;
        
        // Create a table to display all players in a list format
        const table = document.createElement('table');
        table.className = 'player-list-table best-xi-table';
        
        // Add table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th style="width: 10%; text-align: left; padding: 8px; border-bottom: 1px solid #00cccc; color: #00ffff;">No.</th>
                <th style="width: 35%; text-align: left; padding: 8px; border-bottom: 1px solid #00cccc; color: #00ffff;">Player Name</th>
                <th style="width: 25%; text-align: left; padding: 8px; border-bottom: 1px solid #00cccc; color: #00ffff;">Role</th>
                <th style="width: 30%; text-align: left; padding: 8px; border-bottom: 1px solid #00cccc; color: #00ffff;">Team</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Add table body
        const tbody = document.createElement('tbody');
        
        // Sort players by position for better organization
        const positions = ['Batsman', 'Wicketkeeper', 'Allrounder', 'Bowler'];
        const sortedTeam = [];
        
        // Add players in order of positions
        positions.forEach(position => {
            const positionPlayers = team.filter(player => player.position === position);
            sortedTeam.push(...positionPlayers);
        });
        
        // Add each player as a row in the table with sequential numbering
        sortedTeam.forEach((player, index) => {
            const row = document.createElement('tr');
            
            // Apply alternating row colors
            row.className = index % 2 === 0 ? 'odd-row' : 'even-row';
            
            // Check if this player was explicitly selected from the 'Player You Must Pick' dropdown
            // Only players explicitly selected by the user should have stars
            const isMustPickPlayer = mustIncludePlayers.some(selectedPlayerName => {
                // Try different matching approaches since player names might not match exactly
                return player.fullName && (
                    player.fullName.toLowerCase() === selectedPlayerName.toLowerCase() ||
                    player.fullName.toLowerCase().includes(selectedPlayerName.toLowerCase()) ||
                    selectedPlayerName.toLowerCase().includes(player.fullName.toLowerCase())
                );
            });
            
            // Create number cell
            const numberCell = document.createElement('td');
            numberCell.style = "padding: 6px; border-bottom: 1px solid #004d4d; color: #ffffff; font-weight: bold;";
            numberCell.textContent = index + 1;
            row.appendChild(numberCell);
            
            // Create player name cell
            const playerNameCell = document.createElement('td');
            playerNameCell.style = "padding: 6px; border-bottom: 1px solid #004d4d; color: #ffffff;";
            
            // Add player name and star (white asterisk) only for players explicitly selected by the user
            playerNameCell.textContent = player.fullName;
            if (isMustPickPlayer) {
                const star = document.createElement('span');
                star.textContent = ' *';
                star.style.color = 'white';
                star.style.fontSize = '0.8em';
                playerNameCell.appendChild(star);
            }
            row.appendChild(playerNameCell);
            
            // Create position cell
            const positionCell = document.createElement('td');
            positionCell.style = "padding: 6px; border-bottom: 1px solid #004d4d; color: #ffffff; display: flex; align-items: center;";
            
            // Create an image element for the position icon
            const positionIcon = document.createElement('img');
            positionIcon.style = "width: 24px; height: 24px; margin-right: 5px;";
            
            // Set the appropriate SVG file based on player position
            if (player.position === 'Batsman') {
                positionIcon.src = './Batter.svg';
                positionIcon.alt = 'Batsmen';
            } else if (player.position === 'Bowler') {
                positionIcon.src = './Bowler.svg';
                positionIcon.alt = 'Bowler';
            } else if (player.position === 'Allrounder') {
                positionIcon.src = './Allrounder.svg';
                positionIcon.alt = 'Allrounder';
            } else if (player.position === 'Wicketkeeper') {
                positionIcon.src = './Wicketkeeper.svg';
                positionIcon.alt = 'Wicketkeeper';
            }
            
            // Append the icon to the position cell
            positionCell.appendChild(positionIcon);
            row.appendChild(positionCell);
            
            // Create team cell
            const teamCell = document.createElement('td');
            teamCell.style = "padding: 6px; border-bottom: 1px solid #004d4d; color: #ffffff;";
            teamCell.textContent = player.Current_Team;
            row.appendChild(teamCell);
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        teamDisplay.appendChild(table);
    }
});