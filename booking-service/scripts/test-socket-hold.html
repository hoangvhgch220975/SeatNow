<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Socket.IO - Hold/Release Table (Zero-Latency)</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 900px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    .section {
      margin: 20px 0;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 5px;
      border-left: 4px solid #4CAF50;
    }
    label {
      display: block;
      margin: 10px 0 5px;
      font-weight: bold;
      color: #555;
    }
    input, select {
      width: 100%;
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      padding: 12px 24px;
      margin: 5px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    }
    button:hover {
      background: #45a049;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    button.danger {
      background: #f44336;
    }
    button.danger:hover {
      background: #da190b;
    }
    button.secondary {
      background: #2196F3;
    }
    button.secondary:hover {
      background: #0b7dda;
    }
    .log {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 5px;
      max-height: 300px;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      margin-top: 20px;
    }
    .log-entry {
      margin: 5px 0;
      padding: 5px;
      border-left: 3px solid transparent;
    }
    .log-entry.success {
      border-left-color: #4CAF50;
      color: #4CAF50;
    }
    .log-entry.error {
      border-left-color: #f44336;
      color: #f44336;
    }
    .log-entry.info {
      border-left-color: #2196F3;
      color: #64B5F6;
    }
    .log-entry.warning {
      border-left-color: #ff9800;
      color: #ffb74d;
    }
    .status {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
    .status.connected {
      background: #4CAF50;
      color: white;
    }
    .status.disconnected {
      background: #f44336;
      color: white;
    }
    .countdown {
      font-size: 24px;
      font-weight: bold;
      color: #ff9800;
      text-align: center;
      padding: 15px;
      background: #fff3e0;
      border-radius: 5px;
      margin: 10px 0;
    }
    .table-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .table-box {
      aspect-ratio: 1/1;
      border: 2px solid #ddd;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: white;
      position: relative;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .table-box:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    .table-box.available {
      border-color: #4CAF50;
      background: #f1f8e9;
    }
    .table-box.occupied {
      border-color: #f44336;
      background: #ffebee;
      cursor: not-allowed;
    }
    .table-box.held {
      border-color: #FF9800;
      background: #FFF3E0;
      box-shadow: 0 0 10px rgba(255, 152, 0, 0.4);
    }
    .table-box .num {
      font-size: 22px;
      font-weight: 800;
      color: #333;
    }
    .table-box .cap {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    .table-box .type-tag {
      position: absolute;
      top: 5px;
      right: 5px;
      font-size: 9px;
      text-transform: uppercase;
      background: #eee;
      padding: 2px 5px;
      border-radius: 10px;
    }
    .grid-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
      padding: 15px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #eee;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: #555;
    }
    .legend-box {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }
    .legend-box.available { background: #f1f8e9; border-color: #4CAF50; }
    .legend-box.held { background: #FFF3E0; border-color: #FF9800; }
    .legend-box.occupied { background: #ffebee; border-color: #f44336; }
    .legend-box.my-selection { border: 2px dashed #2196F3; background: #e3f2fd; }
    .location-tag {
      font-size: 10px;
      color: #777;
      margin-top: 2px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔌 Test Socket.IO - Zero-Latency Table Sync</h1>
    
    <div class="section">
      <h3>Connection Status: <span id="status" class="status disconnected">Disconnected</span></h3>
      <label>Access Token (Optional):</label>
      <input type="text" id="token" placeholder="Paste access token here...">
      
      <label>Server URL (Through Gateway):</label>
      <input type="text" id="serverUrl" value="http://localhost:7000">
      
      <button onclick="connectSocket()">Connect</button>
      <button onclick="disconnectSocket()" class="danger">Disconnect</button>
    </div>

    <div class="section">
      <h3>Configuration</h3>
      <label>Restaurant ID:</label>
      <input type="text" id="restaurantId" value="BA3FB828-C52C-4FBE-83E7-4F326A9892A2">
      
      <label>Booking Date:</label>
      <input type="date" id="bookingDate">
      
      <label>Booking Time:</label>
      <select id="bookingTime"></select>
      
      <button onclick="joinRestaurant()" class="secondary">Join Room</button>
    </div>

    <div class="section">
      <h3>Live Table Map</h3>
      <div style="margin-bottom: 15px;">
        <label>Filter by Floor:</label>
        <select id="floorFilter" onchange="checkAvailability()">
          <option value="">-- All Floors --</option>
          <option value="1st Floor">1st Floor</option>
          <option value="2nd Floor">2nd Floor</option>
          <option value="3rd Floor">3rd Floor</option>
          <option value="Rooftop">Rooftop</option>
        </select>
        <button onclick="checkAvailability()" class="secondary">Refresh Map</button>
      </div>
      
      <div id="countdown" class="countdown" style="display:none;">
        Holding table for <span id="countdownTime">02:00</span>
      </div>

      <div id="tableSection">
        <div class="grid-legend">
          <div class="legend-item"><div class="legend-box available"></div> Available</div>
          <div class="legend-item"><div class="legend-box held"></div> Someone holding</div>
          <div class="legend-item"><div class="legend-box occupied"></div> Occupied (Booked)</div>
          <div class="legend-item"><div class="legend-box my-selection"></div> Your Selection</div>
        </div>
        <div id="tableGrid" class="table-grid"></div>
      </div>
    </div>

    <div class="section">
      <h3>📊 Event Logs</h3>
      <button onclick="clearLog()" class="secondary">Clear Log</button>
      <div id="log" class="log"></div>
    </div>
  </div>

  <script>
    let socket = null;
    let countdownInterval = null;
    let currentlyHeldTableId = null;
    let isProcessing = false;

    function log(message, type = 'info') {
      const logDiv = document.getElementById('log');
      const timestamp = new Date().toLocaleTimeString('vi-VN');
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      entry.textContent = `[${timestamp}] ${message}`;
      logDiv.appendChild(entry);
      logDiv.scrollTop = logDiv.scrollHeight;
    }

    function clearLog() {
      document.getElementById('log').innerHTML = '';
    }

    function updateStatus(connected) {
      const statusEl = document.getElementById('status');
      statusEl.textContent = connected ? 'Connected' : 'Disconnected';
      statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
    }

    function connectSocket() {
      const serverUrl = document.getElementById('serverUrl').value;
      const token = document.getElementById('token').value.trim();

      const config = { autoConnect: false };
      if (token) config.auth = { token };

      socket = io(serverUrl, config);

      socket.on('connect', () => {
        log('✅ Socket connected successfully!', 'success');
        updateStatus(true);
        joinRestaurant();
        checkAvailability();
      });

      socket.on('disconnect', (reason) => {
        log(`❌ Socket disconnected: ${reason}`, 'error');
        updateStatus(false);
        stopCountdown();
      });

      socket.on('tableStatusChanged', (data) => {
        const { tableId, status, bookingDate, bookingTime } = data;
        log(`⚡ Status Changed: Table ${tableId} -> ${status}`, 'info');
        
        const uiDate = document.getElementById('bookingDate').value;
        const uiTime = document.getElementById('bookingTime').value;
        
        if (bookingDate === uiDate && bookingTime === uiTime) {
          updateSingleTableInGrid(tableId, status);
        }
      });

      socket.connect();
    }

    function disconnectSocket() {
      if (socket) {
        socket.disconnect();
        socket = null;
        updateStatus(false);
        stopCountdown();
      }
    }

    function joinRestaurant() {
      if (!socket || !socket.connected) return;
      const restaurantId = document.getElementById('restaurantId').value;
      socket.emit('joinRestaurant', restaurantId);
      log(`✅ Joined restaurant room: ${restaurantId}`, 'success');
    }

    function holdTable(tableId) {
      return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
          log('❌ Socket not connected!', 'error');
          return reject(new Error('Socket not connected'));
        }

        const data = {
          restaurantId: document.getElementById('restaurantId').value,
          tableId: tableId,
          bookingDate: document.getElementById('bookingDate').value,
          bookingTime: document.getElementById('bookingTime').value
        };

        socket.emit('holdTable', data, (response) => {
          if (response.success) {
            log(`🔒 Table held! Expires in ${response.expiresIn}s`, 'success');
            currentlyHeldTableId = tableId;
            startCountdown(response.expiresIn);
            updateSingleTableInGrid(tableId, 'held');
            resolve(response);
          } else {
            log(`❌ Hold failed: ${response.error}`, 'error');
            reject(new Error(response.error));
          }
        });
      });
    }

    function releaseHold(tableId) {
      return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
          log('❌ Socket not connected!', 'error');
          return reject(new Error('Socket not connected'));
        }

        const data = {
          restaurantId: document.getElementById('restaurantId').value,
          tableId: tableId,
          bookingDate: document.getElementById('bookingDate').value,
          bookingTime: document.getElementById('bookingTime').value
        };

        socket.emit('releaseHold', data, (response) => {
          if (response.success) {
            log(`🔓 Hold released for Table ${tableId}`, 'success');
            if (tableId === currentlyHeldTableId) {
              currentlyHeldTableId = null;
              stopCountdown();
            }
            updateSingleTableInGrid(tableId, 'available');
            resolve(response);
          } else {
            log(`❌ Release failed: ${response.error}`, 'error');
            reject(new Error(response.error));
          }
        });
      });
    }

    function updateSingleTableInGrid(tableId, status) {
      const box = document.getElementById(`table-box-${tableId}`);
      if (!box) return;

      box.classList.remove('available', 'held', 'occupied');
      box.style.border = '';

      if (String(currentlyHeldTableId).toLowerCase() === String(tableId).toLowerCase() && status === 'held') {
        box.classList.add('held');
        box.style.border = '2px dashed #2196F3';
      } else {
        box.classList.add(status);
      }
    }

    async function checkAvailability() {
      const restaurantId = document.getElementById('restaurantId').value;
      const date = document.getElementById('bookingDate').value;
      const time = document.getElementById('bookingTime').value;
      const token = document.getElementById('token').value.trim();

      const serverUrl = document.getElementById('serverUrl').value.replace(/\/$/, '');
      const location = document.getElementById('floorFilter').value;
      
      try {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let tablesUrl = `${serverUrl}/api/v1/restaurants/${restaurantId}/tables`;
        if (location) tablesUrl += `?location=${encodeURIComponent(location)}`;

        const [resAll, resAvail] = await Promise.all([
          fetch(tablesUrl, { headers }),
          fetch(`${serverUrl}/api/v1/booking-restaurants/${restaurantId}/availability?date=${date}&time=${time}&guests=1`)
        ]);

        const dataAll = await resAll.json();
        const dataAvail = await resAvail.json();
        
        renderTableGrid(dataAll.data || [], (dataAvail.items || []).map(t => t.id));
      } catch (err) {
        log(`❌ Refresh Error: ${err.message}`, 'error');
      }
    }

    function renderTableGrid(allTables, availableIds) {
      const grid = document.getElementById('tableGrid');
      grid.innerHTML = '';
      
      allTables.forEach(t => {
        const isAvail = availableIds.some(aid => String(aid).toLowerCase() === String(t.id).toLowerCase());
        const isMine = String(currentlyHeldTableId).toLowerCase() === String(t.id).toLowerCase();
        
        const box = document.createElement('div');
        box.className = 'table-box';
        box.id = `table-box-${t.id}`;
        
        if (isMine) {
          box.classList.add('held');
          box.style.border = '2px dashed #2196F3';
        } else if (isAvail) {
          box.classList.add('available');
        } else {
          box.classList.add('occupied');
        }
        
        box.innerHTML = `
          <span class="type-tag">${t.type}</span>
          <span class="num">${t.tableNumber}</span>
          <span class="cap">${t.capacity} seats</span>
          <span class="location-tag">📍 ${t.location || 'Unknown'}</span>
        `;
        
        box.onclick = async () => {
          if (isProcessing) return;
          
          const dynamicIsMine = String(currentlyHeldTableId).toLowerCase() === String(t.id).toLowerCase();
          
          // Nếu bàn đã occupied (màu đỏ) và không phải của mình, không làm gì cả
          if (box.classList.contains('occupied') && !dynamicIsMine) {
            log(`🚫 Table ${t.tableNumber} is already occupied!`, 'error');
            return;
          }

          isProcessing = true;
          try {
            if (dynamicIsMine) {
              log(`🔓 Releasing hold for table: ${t.tableNumber}...`, 'info');
              await releaseHold(t.id);
            } else {
              // Nếu đang giữ bàn khác, nhả bàn đó ra trước
              if (currentlyHeldTableId && currentlyHeldTableId !== t.id) {
                log(`🕒 Switching tables. Releasing Table ${currentlyHeldTableId}...`, 'warning');
                await releaseHold(currentlyHeldTableId);
              }
              log(`🔒 Attempting to hold table: ${t.tableNumber}...`, 'info');
              await holdTable(t.id);
            }
          } catch (e) {
            log(`❌ Operation failed: ${e.message}`, 'error');
          } finally {
            isProcessing = false;
          }
        };
        
        grid.appendChild(box);
      });
    }

    function startCountdown(seconds) {
      stopCountdown();
      const div = document.getElementById('countdown');
      div.style.display = 'block';
      let remaining = seconds;
      countdownInterval = setInterval(() => {
        remaining--;
        const m = Math.floor(remaining / 60).toString().padStart(2, '0');
        const s = (remaining % 60).toString().padStart(2, '0');
        document.getElementById('countdownTime').textContent = `${m}:${s}`;
        if (remaining <= 0) stopCountdown();
      }, 1000);
    }

    function stopCountdown() {
      clearInterval(countdownInterval);
      document.getElementById('countdown').style.display = 'none';
    }

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('bookingDate').value = new Date().toISOString().split('T')[0];
      const select = document.getElementById('bookingTime');
      for (let h = 7; h <= 21; h += 2) {
        const time = `${h.toString().padStart(2, '0')}:00`;
        const opt = document.createElement('option');
        opt.value = opt.textContent = time;
        select.appendChild(opt);
      }
    });
  </script>
</body>
</html>
