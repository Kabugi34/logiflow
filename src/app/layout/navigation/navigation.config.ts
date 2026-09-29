export interface NavigationItem {
  label: string;
  route: string;
  icon: string;
  children?: NavigationItem[];
}

export interface WorkspaceAccount {
  initials: string;
  name: string;
  subtitle: string;
}

export interface WorkspaceConfig {
  name: string;
  homeRoute: string;
  searchPlaceholder: string;
  navigation: NavigationItem[];
  account: WorkspaceAccount;
}

export const manufacturerNavigation: NavigationItem[] = [
  {
    label: 'Dashboard',
    route: '/manufacturer/dashboard',
    icon: 'grid'
  },
  {
    label: 'Products',
    route: '/manufacturer/products',
    icon: 'package'
  },
  {
    label: 'Inventory',
    route: '/manufacturer/inventory',
    icon: 'layers'
  },
  {
    label: 'Purchase Orders',
    route: '/manufacturer/purchase-orders',
    icon: 'file-text'
  },
  {
    label: 'Shipments',
    route: '/manufacturer/shipments',
    icon: 'truck'
  },
  {
    label: 'Logistics',
    route: '/manufacturer/logistics',
    icon: 'map',
    children: [
      {
        label: 'Active Trips',
        route: '/manufacturer/logistics/trips',
        icon: 'route'
      },
      {
        label: 'Live Map',
        route: '/manufacturer/logistics/live-map',
        icon: 'map-pin'
      }
    ]
  },
  {
    label: 'Drivers',
    route: '/manufacturer/drivers',
    icon: 'users'
  },
  {
    label: 'Vehicles',
    route: '/manufacturer/vehicles',
    icon: 'truck'
  },
  {
    label: 'Staff',
    route: '/manufacturer/staff',
    icon: 'users'
  },
  {
    label: 'Warehouses',
    route: '/manufacturer/warehouses',
    icon: 'warehouse'
  },
  {
    label: 'Reports',
    route: '/manufacturer/reports',
    icon: 'bar-chart'
  },
  {
    label: 'Settings',
    route: '/manufacturer/settings',
    icon: 'settings'
  }
];

export const distributorNavigation: NavigationItem[] = [
  {
    label: 'Dashboard',
    route: '/distributor/dashboard',
    icon: 'grid'
  },
  {
    label: 'Orders',
    route: '/distributor/orders',
    icon: 'shopping-bag'
  }
];

export const manufacturerWorkspace: WorkspaceConfig = {
  name: 'Manufacturer',
  homeRoute: '/manufacturer/dashboard',
  searchPlaceholder: 'Universal lookup (PO, SKU, Driver)...',
  navigation: manufacturerNavigation,
  account: { initials: 'MV', name: 'Marcus Vance', subtitle: 'Global Operations' }
};

export const distributorWorkspace: WorkspaceConfig = {
  name: 'Distributor',
  homeRoute: '/distributor/dashboard',
  searchPlaceholder: 'Search order, customer, SKU...',
  navigation: distributorNavigation,
  account: { initials: 'VD', name: 'Vance Distributors', subtitle: 'Enterprise Wholesaler' }
};
