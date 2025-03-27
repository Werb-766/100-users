document.addEventListener('DOMContentLoaded', function() {
    // State management
    let usersData = [];
    let currentPage = 1;
    const usersPerPage = 12;
    let currentView = 'grid';
    let favorites = new Set(JSON.parse(localStorage.getItem('favorites')) || []);
    let lastUpdate = null;
    
    // DOM Elements
    const loader = document.getElementById('loader');
    const userList = document.getElementById('userList');
    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const sortSelect = document.getElementById('sortSelect');
    const filterGender = document.getElementById('filterGender');
    const ageRange = document.getElementById('ageRange');
    const gridViewBtn = document.getElementById('gridView');
    const listViewBtn = document.getElementById('listView');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const modal = document.getElementById('userModal');
    const modalContent = document.getElementById('userDetails');
    const closeModal = document.querySelector('.close');
  
    // Utility Functions
    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
  
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
  
    const calculateAge = (birthDate) => {
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };
  
    const getZodiacSign = (dateString) => {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      
      const signs = {
        'Qo\'y': [[3, 21], [4, 19]],
        'Buzoq': [[4, 20], [5, 20]],
        'Egizaklar': [[5, 21], [6, 20]],
        'Qisqichbaqa': [[6, 21], [7, 22]],
        'Arslon': [[7, 23], [8, 22]],
        'Boshoq': [[8, 23], [9, 22]],
        'Tarozi': [[9, 23], [10, 22]],
        'Chayon': [[10, 23], [11, 21]],
        'Yoy': [[11, 22], [12, 21]],
        'Echki': [[12, 22], [1, 19]],
        'Qovg\'a': [[1, 20], [2, 18]],
        'Baliq': [[2, 19], [3, 20]]
      };
  
      for (const [sign, [[startMonth, startDay], [endMonth, endDay]]] of Object.entries(signs)) {
        if (
          (month === startMonth && day >= startDay) ||
          (month === endMonth && day <= endDay)
        ) {
          return sign;
        }
      }
      return 'Echki'; // Default for edge case
    };
  
    const generateRandomColor = () => {
      const letters = '0123456789ABCDEF';
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    };
  
    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        showNotification('Nusxalandi!');
      } catch (err) {
        showNotification('Nusxalash muvaffaqiyatsiz bo\'ldi');
      }
    };
  
    const showNotification = (message) => {
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    };
  
    // Data Management Functions
    const saveToLocalStorage = (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('Local storage error:', error);
      }
    };
  
    const loadFromLocalStorage = (key) => {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch (error) {
        console.error('Local storage error:', error);
        return null;
      }
    };
  
    const toggleFavorite = (userId) => {
      if (favorites.has(userId)) {
        favorites.delete(userId);
      } else {
        favorites.add(userId);
      }
      saveToLocalStorage('favorites', Array.from(favorites));
      displayUsers();
    };
  
    // API Functions
    async function fetchUsers() {
      try {
        const response = await fetch('https://randomuser.me/api/?results=100&seed=abc');
        const data = await response.json();
        usersData = data.results.map(user => ({
          ...user,
          id: user.login.uuid,
          favorite: favorites.has(user.login.uuid)
        }));
        lastUpdate = new Date();
        updateStats();
        displayUsers();
        loader.style.display = 'none';
      } catch (error) {
        console.error('Error fetching users:', error);
        loader.innerHTML = 'Xatolik! Ma\'lumot yuklanmadi.';
      }
    }
  
    // Statistics Functions
    function updateStats() {
      const stats = calculateStats();
      document.getElementById('totalUsers').textContent = stats.total;
      document.getElementById('maleCount').textContent = stats.male;
      document.getElementById('femaleCount').textContent = stats.female;
      document.getElementById('countriesCount').textContent = stats.countries;
    }
  
    function calculateStats() {
      return {
        total: usersData.length,
        male: usersData.filter(user => user.gender === 'male').length,
        female: usersData.filter(user => user.gender === 'female').length,
        countries: new Set(usersData.map(user => user.location.country)).size,
        averageAge: Math.round(usersData.reduce((acc, user) => acc + user.dob.age, 0) / usersData.length),
        favorites: favorites.size
      };
    }
  
    // Filter Functions
    function filterUsers() {
      const searchText = searchInput.value.toLowerCase();
      const searchTypeValue = searchType.value;
      const genderFilter = filterGender.value;
      const ageRangeFilter = ageRange.value;
  
      return usersData.filter(user => {
        const searchMatch = getSearchMatch(user, searchText, searchTypeValue);
        const genderMatch = getGenderMatch(user, genderFilter);
        const ageMatch = getAgeMatch(user, ageRangeFilter);
  
        return searchMatch && genderMatch && ageMatch;
      });
    }
  
    function getSearchMatch(user, searchText, searchType) {
      if (!searchText) return true;
  
      switch (searchType) {
        case 'name':
          return `${user.name.first} ${user.name.last}`.toLowerCase().includes(searchText);
        case 'location':
          return `${user.location.city} ${user.location.country}`.toLowerCase().includes(searchText);
        case 'email':
          return user.email.toLowerCase().includes(searchText);
        default:
          return true;
      }
    }
  
    function getGenderMatch(user, genderFilter) {
      return genderFilter === 'all' || user.gender === genderFilter;
    }
  
    function getAgeMatch(user, ageRangeFilter) {
      if (ageRangeFilter === 'all') return true;
  
      const age = user.dob.age;
      switch (ageRangeFilter) {
        case '18-30':
          return age >= 18 && age <= 30;
        case '31-50':
          return age >= 31 && age <= 50;
        case '51+':
          return age >= 51;
        default:
          return true;
      }
    }
  
    // Sort Functions
    function sortUsers(users) {
      const sortBy = sortSelect.value;
      return [...users].sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return `${a.name.first} ${a.name.last}`.localeCompare(`${b.name.first} ${b.name.last}`);
          case 'age':
            return a.dob.age - b.dob.age;
          case 'location':
            return a.location.country.localeCompare(b.location.country);
          default:
            return 0;
        }
      });
    }
  
    // Display Functions
    function displayUsers() {
      const filteredUsers = filterUsers();
      const sortedUsers = sortUsers(filteredUsers);
      
      const totalPages = Math.ceil(sortedUsers.length / usersPerPage);
      currentPage = Math.min(currentPage, totalPages);
      
      const start = (currentPage - 1) * usersPerPage;
      const end = start + usersPerPage;
      const paginatedUsers = sortedUsers.slice(start, end);
  
      userList.innerHTML = '';
      paginatedUsers.forEach(user => {
        const userCard = createUserCard(user);
        userList.appendChild(userCard);
      });
  
      updatePagination(currentPage, totalPages);
    }
  
    function createUserCard(user) {
      const userCard = document.createElement('div');
      userCard.classList.add('user-card');
      
      const favoriteClass = favorites.has(user.id) ? 'fas' : 'far';
      const userContent = `
        <img src="${user.picture.medium}" alt="${user.name.first} ${user.name.last}">
        <div class="user-info">
          <h3>${user.name.first} ${user.name.last}</h3>
          <p><i class="fas fa-birthday-cake"></i> ${user.dob.age} yosh</p>
          <p><i class="fas fa-envelope"></i> ${user.email}</p>
          <p><i class="fas fa-map-marker-alt"></i> ${user.location.city}, ${user.location.country}</p>
          <button class="favorite-btn" data-id="${user.id}">
            <i class="${favoriteClass} fa-heart"></i>
          </button>
        </div>
      `;
      
      userCard.innerHTML = userContent;
      
      // Add event listeners
      userCard.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(user.id);
      });
      
      userCard.addEventListener('click', () => showUserDetails(user));
      
      return userCard;
    }
  
    function updatePagination(currentPage, totalPages) {
      currentPageSpan.textContent = currentPage;
      totalPagesSpan.textContent = totalPages;
      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage === totalPages;
    }
  
    function showUserDetails(user) {
      const zodiacSign = getZodiacSign(user.dob.date);
      const age = calculateAge(user.dob.date);
      const detailsHTML = `
        <div class="user-details">
          <img src="${user.picture.large}" alt="${user.name.first} ${user.name.last}">
          <h2>${user.name.first} ${user.name.last}</h2>
          <div class="details-grid">
            <div class="detail-item">
              <i class="fas fa-birthday-cake"></i>
              <p>Tug'ilgan sana: ${formatDate(user.dob.date)}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-star"></i>
              <p>Yosh: ${age}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-moon"></i>
              <p>Burj: ${zodiacSign}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-venus-mars"></i>
              <p>Jinsi: ${user.gender === 'male' ? 'Erkak' : 'Ayol'}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-phone"></i>
              <p>Telefon: ${user.phone}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-mobile-alt"></i>
              <p>Mobil: ${user.cell}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-envelope"></i>
              <p>Email: ${user.email}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-map-marked-alt"></i>
              <p>Manzil: ${user.location.street.number} ${user.location.street.name}, ${user.location.city}, ${user.location.state}, ${user.location.country}</p>
            </div>
            <div class="detail-item">
              <i class="fas fa-calendar-alt"></i>
              <p>Ro'yxatdan o'tgan sana: ${formatDate(user.registered.date)}</p>
            </div>
          </div>
          <div class="action-buttons">
            <button onclick="copyToClipboard('${user.email}')">
              <i class="fas fa-copy"></i> Email nusxalash
            </button>
            <button onclick="copyToClipboard('${user.phone}')">
              <i class="fas fa-copy"></i> Telefon nusxalash
            </button>
          </div>
        </div>
      `;
      
      modalContent.innerHTML = detailsHTML;
      modal.style.display = 'block';
    }
  
    // Event Listeners
    const debouncedDisplayUsers = debounce(displayUsers, 300);
    
    searchInput.addEventListener('input', debouncedDisplayUsers);
    searchType.addEventListener('change', displayUsers);
    sortSelect.addEventListener('change', displayUsers);
    filterGender.addEventListener('change', displayUsers);
    ageRange.addEventListener('change', displayUsers);
  
    gridViewBtn.addEventListener('click', () => {
      currentView = 'grid';
      userList.className = 'user-list grid-view';
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
    });
  
    listViewBtn.addEventListener('click', () => {
      currentView = 'list';
      userList.className = 'user-list list-view';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
    });
  
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        displayUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  
    nextPageBtn.addEventListener('click', () => {
      const filteredUsers = filterUsers();
      const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        displayUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  
    closeModal.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  
    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        modal.style.display = 'none';
      }
    });
  
    // Initialize
    fetchUsers();
  });