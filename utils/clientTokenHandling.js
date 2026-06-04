// Helper function to decode and check user type
export const getUserFromToken = () => {
    if (typeof window === 'undefined') return null;
    
    const token = localStorage.getItem('clientTokens');
    const clientData = localStorage.getItem('client');
    
    if (!token || !clientData) return null;
    
    try {
        const user = JSON.parse(clientData);
        return user;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
};

// Check if user is client owner or has specific permission
export const hasPermission = (permission) => {
    const user = getUserFromToken();
    if (!user) return false;
    
    if (user.userType === 'client') {
        // Clients have all permissions
        return true;
    }
    
    if (user.userType === 'team_member') {
        // Team owners have all permissions
        if (user.isOwner) return true;
        // Check specific permission
        return user.permissions.includes(permission);
    }
    
    return false;
};

// Check user role
export const getUserRole = () => {
    const user = getUserFromToken();
    if (!user) return null;
    
    if (user.userType === 'client') return 'client';
    return user.role;
};

// Check if user can access a feature
export const canAccess = (feature) => {
    const user = getUserFromToken();
    if (!user) return false;
    
    // Clients can access everything
    if (user.userType === 'client') return true;
    
    // Team members based on role/permissions
    const featurePermissions = {
        'billing': ['view_billing', 'manage_subscription'],
        'api-keys': ['view_api_keys', 'manage_api_keys'],
        'team-management': ['invite_members', 'manage_members'],
        // Add more feature-permission mappings
    };
    
    const requiredPerms = featurePermissions[feature] || [];
    return requiredPerms.some(perm => hasPermission(perm));
};