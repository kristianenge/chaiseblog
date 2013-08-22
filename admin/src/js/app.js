(function(){"use strict";})();

// initialize the app :D
var app = angular.module('app', []);

// root url to make database requests against
// set to '_rewrite/root' if not using a virtualhost
app.constant('root', 'api');

// markdown converter
app.value('md', new Showdown.converter());

// get posts from a given view
app.factory('getPosts', function($http, root){
  return function(viewname, opts){
    var posts = $http({
      url: [root, "_design/chaiseblog/_view", viewname].join('/')
    , method: 'GET'
    , params: {
        include_docs: true
      }
    });
    if(opts.success){
      posts.success(function(data, status){
        var docs = [];
        for(var i in data.rows){
          docs.push(data.rows[i].doc);
        }
        opts.success(docs);
      });
    }
    posts.error(function(){
      console.log(arguments);
    });
    return posts;
  };
});

app.factory('deletePost', function($http, root){
  return function(post){
    return $http({
      url: [root, post._id].join('/')
    , method: 'DELETE'
    , params: {
        rev: post._rev
      }
    })
  }
});

// autosave posts while writing them
app.factory('autosave', function($http, $timeout, root){
  return function(post){
    (function _autosave(){
      $http({
        url: [root, post._id].join('/')
      , method: 'PUT'
      , data: post
      })
      .success(function(data, status){
        post._rev = data.rev;
        // save every thirty seconds
        $timeout(_autosave, 1000 * 30);
      })
      .error(function(){
        console.log(arguments);
      })
      ;
    })();
  };
});

app.factory('listCtrl', function(getPosts, deletePost){
  return function($scope, view){
    $scope.delete = function(post){
      if(confirm("Are you sure you want to delete that post?")){
        deletePost(post).success(function(){
          $scope.posts = $scope.posts.filter(function(doc){ return doc._id !== post._id })
        }) 
      }
    }
    getPosts(view, {
      success: function(docs){
        $scope.posts = docs;
      }
    });
  }
})

// list all posts
function PostsCtrl($scope, listCtrl){
  listCtrl($scope, 'published')
}

// list all drafts
function DraftsCtrl($scope, listCtrl){
  listCtrl($scope, 'drafts')
}

// form for a new post
function NewCtrl($scope, $http, $location, root){
  $scope.submit = function(){
    $scope.post.date = Date.now();
    $http({
      url: root,
      method: 'POST',
      data: $scope.post
    }).success(function(data, status){
      $location.path('/');
    }).error(function(){
      console.log(arguments);
    });
  };
}

// form to edit existing post
function EditCtrl($scope, $http, $location, $routeParams, root, autosave){
  var doc_url = [root, $routeParams.id].join('/')
    , post = $http.get(doc_url);
  post.success(function(data, status){
    $scope.post = data;
    autosave($scope.post);
  });
  $scope.submit = function(){
    $http.put(doc_url, $scope.post)
    .success(function(data, status){
      $location.path('/');
    })
    .error(function(){
      console.log(arguments);
    });
  };
}

// list a single post, draft or otherwise
function PostCtrl($scope, $http, $routeParams, root){
  var doc_url = [root, $routeParams.id].join('/')
    , post = $http.get(doc_url);
  post.success(function(data, status){
    $scope.posts = [data];
  });
}

// url router
app.config(function($routeProvider, $locationProvider){
  $routeProvider
  .when('/', {
    templateUrl: 'posts.html',
    controller: PostsCtrl
  })
  .when('/drafts', {
    templateUrl: 'posts.html',
    controller: DraftsCtrl
  })
  .when('/new', {
    templateUrl: 'new.html',
    controller: NewCtrl
  })
  .when('/edit/:id', {
    templateUrl: 'new.html',
    controller: EditCtrl
  })
  .when('/post/:id', {
    templateUrl: 'posts.html',
    controller: PostCtrl
  })
  .otherwise({
    redirectTo: '/'
  });
});

// markdown filter for dynamic content
app.filter('markdown', function(md){
  return function(input){
    if(input) return md.makeHtml(input);
  };
});