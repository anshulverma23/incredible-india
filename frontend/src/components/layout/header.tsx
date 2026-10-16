import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Heart,
  User,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { isAdminRole } from "@/features/auth/types";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

const navLinks = [
  { name: "Destinations", href: "/destinations" },
  { name: "Hotels", href: "/hotels" },
  { name: "Packages", href: "/packages" },
  { name: "Plan a Trip", href: "/plan-trip" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
  { name: "Blog", href: "/blog" },
  { name: "FAQ", href: "/faq" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
    : "U";

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-manrope text-2xl md:text-3xl font-bold text-primary tracking-tight">
              Incredible India
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="px-3.5 py-2 text-md font-medium text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right side: wishlist + auth */}
          <div className="hidden md:flex items-center gap-2">
            {user && (
              <>
                <NotificationBell />
                <Link
                  to="/wishlist"
                  className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                  aria-label="Wishlist"
                >
                  <Heart className="w-5 h-5" />
                </Link>
              </>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-full hover:bg-muted transition-colors" />
                  }
                >
                  <Avatar className="size-7">
                    {user.avatar?.url ? (
                      <AvatarImage src={user.avatar.url} alt={user.name} />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    render={<Link to="/dashboard" />}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link to="/bookings" />}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4" /> My Bookings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link to="/wishlist" />}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Heart className="w-4 h-4" /> Wishlist
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link to="/profile" />}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4" /> Profile
                  </DropdownMenuItem>
                  {isAdminRole(user.role) && (
                    <DropdownMenuItem
                      render={<Link to="/admin" />}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-destructive"
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" render={<Link to="/login" />}>
                  Login
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  render={<Link to="/register" />}
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="py-3 text-sm font-medium text-foreground"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className="h-px bg-border my-2" />
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="py-3 text-sm font-medium text-foreground"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/bookings"
                    className="py-3 text-sm font-medium text-foreground"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    My Bookings
                  </Link>
                  <Link
                    to="/wishlist"
                    className="py-3 text-sm font-medium text-foreground"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Wishlist
                  </Link>
                  <Link
                    to="/profile"
                    className="py-3 text-sm font-medium text-foreground"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  {isAdminRole(user.role) && (
                    <Link
                      to="/admin"
                      className="py-3 text-sm font-medium text-foreground"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Admin Panel
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={handleLogout}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Button
                    variant="outline"
                    render={
                      <Link to="/login" onClick={() => setIsMenuOpen(false)} />
                    }
                  >
                    Login
                  </Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    render={
                      <Link
                        to="/register"
                        onClick={() => setIsMenuOpen(false)}
                      />
                    }
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
