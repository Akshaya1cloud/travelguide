// Shared authentication utility
function enforceAuth() {
  try {
    const user = localStorage.getItem('vp_user');
    if (!user) {
      window.location.replace('register.html');
    }
    return JSON.parse(user);
  } catch(e) {
    window.location.replace('register.html');
  }
}

function logout() {
  localStorage.removeItem('vp_user');
  window.location.href = 'register.html';
}

function getUserName() {
  try {
    const user = localStorage.getItem('vp_user');
    return user ? JSON.parse(user).username : 'Guest';
  } catch(e) {
    return 'Guest';
  }
}
