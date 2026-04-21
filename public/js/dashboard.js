// Funciones globales del dashboard
function toggleNotifications() {
  // Implementar lógica de notificaciones
  console.log('Toggle notifications');
}

function toggleDropdown() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  
  if (sidebar && mainContent) {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
  }
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', function(event) {
  const dropdowns = document.querySelectorAll('.dropdown-menu');
  dropdowns.forEach(function(dropdown) {
    if (!event.target.closest('.dropdown')) {
      dropdown.classList.remove('show');
    }
  });
});

// Responsive sidebar toggle
document.addEventListener('DOMContentLoaded', function() {
  // Agregar botón de menú móvil si no existe
  if (!document.querySelector('.mobile-menu-toggle')) {
    const header = document.querySelector('.header-container');
    const mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-menu-toggle';
    mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
    mobileToggle.onclick = toggleSidebar;
    header.appendChild(mobileToggle);
  }
  
  // Manejar responsive
  function handleResize() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (window.innerWidth <= 768) {
      if (sidebar) sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('expanded');
    } else {
      if (sidebar) sidebar.classList.remove('collapsed');
      if (mainContent) mainContent.classList.remove('expanded');
    }
  }
  
  window.addEventListener('resize', handleResize);
  handleResize(); // Ejecutar al cargar
});

// Utilidades para animaciones
function animateValue(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    element.textContent = Math.floor(current);
    
    if (current >= end) {
      clearInterval(timer);
      element.textContent = end;
    }
  }, 16);
}

// Función para mostrar toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}
