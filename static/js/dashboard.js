// Dashboard-specific JavaScript

class DashboardManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadDashboardData();
        this.setupAutoRefresh();
    }
    
    bindEvents() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterComplaints(e));
        });
        
        // Search functionality
        const searchInput = document.getElementById('searchComplaints');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchComplaints(e));
        }
        
        // Export buttons
        document.getElementById('exportComplaints')?.addEventListener('click', () => this.exportComplaints());
        
        // Refresh button
        document.getElementById('refreshDashboard')?.addEventListener('click', () => this.loadDashboardData());
    }
    
    filterComplaints(event) {
        const filter = event.target.getAttribute('data-filter');
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Filter table rows
        const rows = document.querySelectorAll('#complaintsTable tbody tr');
        rows.forEach(row => {
            if (filter === 'all') {
                row.style.display = '';
            } else {
                const status = row.querySelector('.status-badge').textContent.toLowerCase();
                if (status.includes(filter)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
        
        this.updateStats();
    }
    
    searchComplaints(event) {
        const searchTerm = event.target.value.toLowerCase();
        const rows = document.querySelectorAll('#complaintsTable tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
    
    async loadDashboardData() {
        try {
            // Show loading state
            this.showLoading(true);
            
            // Load recent complaints
            const response = await fetch('/api/complaints/recent');
            if (response.ok) {
                const complaints = await response.json();
                this.updateComplaintsTable(complaints);
            }
            
            // Load stats
            await this.loadStats();
            
            // Load chart data
            await this.loadCharts();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showNotification('Error loading dashboard data', 'danger');
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/dashboard/stats');
            if (response.ok) {
                const stats = await response.json();
                
                // Update stat cards
                document.querySelectorAll('.stat-number').forEach(el => {
                    const statType = el.closest('.stat-card').classList[1]; // pending, resolved, etc.
                    if (stats[statType] !== undefined) {
                        el.textContent = stats[statType];
                    }
                });
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    updateComplaintsTable(complaints) {
        const tbody = document.querySelector('#complaintsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (complaints.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <i class="fas fa-clipboard-list" style="font-size: 40px; color: var(--light); margin-bottom: 15px; display: block;"></i>
                    <p>No complaints found</p>
                </td>
            `;
            tbody.appendChild(row);
            return;
        }
        
        complaints.forEach(complaint => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(complaint.created_at);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Determine status badge class
            let statusClass = 'status-pending';
            if (complaint.status === 'In Progress') statusClass = 'status-in-progress';
            if (complaint.status === 'Resolved') statusClass = 'status-resolved';
            
            // Determine priority badge class
            let priorityClass = 'priority-medium';
            if (complaint.priority === 'Low') priorityClass = 'priority-low';
            if (complaint.priority === 'High') priorityClass = 'priority-high';
            if (complaint.priority === 'Critical') priorityClass = 'priority-critical';
            
            row.innerHTML = `
                <td>#${complaint.id}</td>
                <td>${complaint.title}</td>
                <td><span class="badge badge-secondary">${complaint.category}</span></td>
                <td><span class="status-badge ${statusClass}">${complaint.status}</span></td>
                <td><span class="priority-badge ${priorityClass}">${complaint.priority}</span></td>
                <td>${complaint.department || 'Not assigned'}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="viewComplaint(${complaint.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    async loadCharts() {
        try {
            // Load category distribution
            const catResponse = await fetch('/api/analytics/category-distribution');
            if (catResponse.ok) {
                const catData = await catResponse.json();
                this.updateCategoryChart(catData);
            }
            
            // Load status distribution
            const statusResponse = await fetch('/api/analytics/status-distribution');
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                this.updateStatusChart(statusData);
            }
            
            // Load monthly trend
            const trendResponse = await fetch('/api/analytics/monthly-trend');
            if (trendResponse.ok) {
                const trendData = await trendResponse.json();
                this.updateTrendChart(trendData);
            }
            
        } catch (error) {
            console.error('Error loading charts:', error);
        }
    }
    
    updateCategoryChart(data) {
        const ctx = document.getElementById('categoryChart')?.getContext('2d');
        if (!ctx) return;
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#8AC926', '#1982C4'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
    
    updateStatusChart(data) {
        const ctx = document.getElementById('statusChart')?.getContext('2d');
        if (!ctx) return;
        
        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Pending', 'In Progress', 'Resolved'],
                datasets: [{
                    data: [data.pending, data.inProgress, data.resolved],
                    backgroundColor: [
                        '#FFCE56', // Warning for Pending
                        '#36A2EB', // Info for In Progress
                        '#4BC0C0'  // Success for Resolved
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
    
    updateTrendChart(data) {
        const ctx = document.getElementById('trendChart')?.getContext('2d');
        if (!ctx) return;
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{
                    label: 'Complaints',
                    data: data.counts,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    updateStats() {
        const visibleRows = document.querySelectorAll('#complaintsTable tbody tr[style=""]').length;
        const totalRows = document.querySelectorAll('#complaintsTable tbody tr').length;
        
        // Update visible count
        document.getElementById('visibleCount')?.textContent = visibleRows;
        document.getElementById('totalCount')?.textContent = totalRows;
    }
    
    exportComplaints() {
        // Get visible complaints data
        const rows = document.querySelectorAll('#complaintsTable tbody tr[style=""]');
        const data = [];
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                data.push({
                    id: cells[0].textContent.trim(),
                    title: cells[1].textContent.trim(),
                    category: cells[2].textContent.trim(),
                    status: cells[3].textContent.trim(),
                    priority: cells[4].textContent.trim(),
                    department: cells[5].textContent.trim(),
                    date: cells[6].textContent.trim()
                });
            }
        });
        
        // Convert to CSV
        let csv = 'ID,Title,Category,Status,Priority,Department,Date\n';
        data.forEach(item => {
            csv += `"${item.id}","${item.title}","${item.category}","${item.status}","${item.priority}","${item.department}","${item.date}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `complaints_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification('Complaints exported successfully!', 'success');
    }
    
    setupAutoRefresh() {
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('dashboardLoading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        
        if (show) {
            showNotification('Loading dashboard data...', 'info');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// Helper function to view complaint
function viewComplaint(id) {
    window.location.href = `/complaint/${id}`;
}

// Helper function to update complaint status
async function updateComplaintStatus(complaintId, status) {
    try {
        const response = await fetch(`/api/complaints/${complaintId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showNotification('Status updated successfully!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            throw new Error('Failed to update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error updating status', 'danger');
    }
}